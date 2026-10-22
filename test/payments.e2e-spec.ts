import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  registerVerified,
  SEED_ADMIN_EMAIL,
  tokensFor,
  uniqueEmail,
} from './helpers';

const PRICE = 500_000; // 5 000 ₸ in tiyn

describe('Course payments and paid content (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let authorToken: string;
  let courseId: string;
  let lessonId: string;
  let materialId: string;

  const http = () => request(app.getHttpServer());

  async function newSubscriber(prefix: string) {
    const res = await registerVerified(app, {
      email: uniqueEmail(prefix),
      password: 'Password1!',
      fullName: 'Paying Student',
      role: 'SUBSCRIBER',
    });
    const body = res.body as {
      accessToken: string;
      user: { id: string; email: string };
    };
    return {
      token: body.accessToken,
      id: body.user.id,
      email: body.user.email,
    };
  }

  function cancelAs(token: string, course = courseId) {
    return http()
      .post(`/api/v1/courses/${course}/enrollments/cancel`)
      .set('Authorization', `Bearer ${token}`);
  }

  function pay(token: string, amount: number, course = courseId) {
    return http()
      .post(`/api/v1/courses/${course}/enrollments/purchase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paidAmountCents: amount });
  }

  function decide(
    action: 'approve' | 'reject' | 'request-more' | 'adjust-amount',
    enrollmentId: string,
    token = adminToken,
    body: object = {},
  ) {
    return http()
      .post(`/api/v1/courses/${courseId}/enrollments/${enrollmentId}/${action}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminToken = (await tokensFor(app, SEED_ADMIN_EMAIL)).accessToken;
    authorToken = (
      (
        await registerVerified(app, {
          email: uniqueEmail('pay-author'),
          password: 'Password1!',
          fullName: 'Pay Author',
          role: 'AUTHOR',
        })
      ).body as { accessToken: string }
    ).accessToken;

    const course = await http()
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Paid course',
        description: 'Paid',
        category: 'methods',
        priceCents: PRICE,
        ratingAvg: 5,
        ratingCount: 999,
      })
      .expect(201);
    courseId = (course.body as { id: string }).id;
    await http()
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const lesson = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Paid lesson',
        content: 'SECRET_PAID_CONTENT',
        orderNumber: 1,
        isPublished: true,
      })
      .expect(201);
    lessonId = (lesson.body as { id: string }).id;

    const material = await prisma.lessonMaterial.create({
      data: {
        lessonId,
        title: 'Slides',
        cloudinaryPublicId: `test-slides-${Date.now()}`,
        url: 'https://example.com/slides.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(1024),
      },
    });
    materialId = material.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('paid content is locked', () => {
    it('authors cannot set their own rating', async () => {
      const course = await http().get(`/api/v1/courses/${courseId}`);
      const body = course.body as { ratingAvg: number; ratingCount: number };
      expect(body.ratingCount).toBe(0);
    });

    it('published lesson is listed but its content needs an approved enrollment', async () => {
      const list = await http()
        .get(`/api/v1/courses/${courseId}/lessons`)
        .expect(200);
      expect((list.body as { id: string }[]).map((l) => l.id)).toContain(
        lessonId,
      );

      await http().get(`/api/v1/lessons/${lessonId}`).expect(403);

      const sub = await newSubscriber('locked');
      const res = await http()
        .get(`/api/v1/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(403);
      expect(JSON.stringify(res.body)).not.toContain('SECRET_PAID_CONTENT');

      await http()
        .get(`/api/v1/materials/${materialId}/download`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(403);
      await http()
        .post(`/api/v1/lessons/${lessonId}/complete`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(403);
    });
  });

  describe('purchase → review', () => {
    it('full flow: pay, admin approves, content opens', async () => {
      const sub = await newSubscriber('flow');

      const paid = await pay(sub.token, PRICE).expect(200);
      const enrollment = paid.body as {
        id: string;
        status: string;
        paidAmountCents: number;
        expectedAmountCents: number;
      };
      expect(enrollment).toMatchObject({
        status: 'PAID',
        paidAmountCents: PRICE,
        expectedAmountCents: PRICE,
      });

      // A PAID enrollment cannot be paid again while it waits for review.
      await pay(sub.token, PRICE).expect(400);

      const admin = await http()
        .get('/api/v1/admin/enrollments/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((admin.body as { id: string }[]).map((e) => e.id)).toContain(
        enrollment.id,
      );

      await decide('approve', enrollment.id).expect(200);
      await decide('approve', enrollment.id).expect(400);
      await decide('reject', enrollment.id).expect(400);

      const lesson = await http()
        .get(`/api/v1/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(200);
      expect((lesson.body as { content: string }).content).toBe(
        'SECRET_PAID_CONTENT',
      );

      const detail = await http()
        .get(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(200);
      expect((detail.body as { hasAccess: boolean }).hasAccess).toBe(true);
    });

    it('underpaid: admin asks for more, student tops up, totals add up', async () => {
      const sub = await newSubscriber('under');
      const first = await pay(sub.token, 200_000).expect(200);
      const id = (first.body as { id: string }).id;

      await decide('request-more', id, adminToken, { note: 'x' }).expect(400);
      const more = await decide('request-more', id, adminToken, {
        note: 'Тағы 3 000 ₸ төлеңіз',
      }).expect(200);
      expect((more.body as { status: string }).status).toBe('UNDERPAID');

      // Not paid in full yet: cannot be approved.
      await decide('approve', id).expect(400);

      const topUp = await pay(sub.token, 300_000).expect(200);
      expect(topUp.body).toMatchObject({
        status: 'PAID',
        paidAmountCents: PRICE,
        expectedAmountCents: PRICE,
      });
      expect(
        (topUp.body as { adminPaymentNote?: string }).adminPaymentNote,
      ).toBeUndefined();
    });

    it('rejected payment is discarded: paying again starts from the full price', async () => {
      const sub = await newSubscriber('reject');
      const first = await pay(sub.token, 100_000).expect(200);
      const id = (first.body as { id: string }).id;

      const rejected = await decide('reject', id).expect(200);
      expect((rejected.body as { status: string }).status).toBe('REJECTED');

      const again = await pay(sub.token, PRICE).expect(200);
      expect(again.body).toMatchObject({
        id,
        status: 'PAID',
        paidAmountCents: PRICE,
        expectedAmountCents: PRICE,
      });
    });

    it('concurrent first submissions create one enrollment and do not 500', async () => {
      const sub = await newSubscriber('race');
      const results = await Promise.all([
        pay(sub.token, PRICE),
        pay(sub.token, PRICE),
      ]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).not.toContain(500);
      expect(statuses).toContain(200);

      const rows = await prisma.courseEnrollment.findMany({
        where: { courseId, userId: sub.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].paidAmountCents).toBe(PRICE);
    });

    it('validates the amount', async () => {
      const sub = await newSubscriber('amount');
      await pay(sub.token, 0).expect(400);
      await pay(sub.token, -5).expect(400);
      await pay(sub.token, 2_000_000_000).expect(400);
      await http()
        .post(`/api/v1/courses/${courseId}/enrollments/purchase`)
        .set('Authorization', `Bearer ${sub.token}`)
        .send({})
        .expect(400);
    });

    it('only subscribers pay; strangers cannot review', async () => {
      await pay(authorToken, PRICE).expect(403);

      const sub = await newSubscriber('stranger');
      const paid = await pay(sub.token, PRICE).expect(200);
      const id = (paid.body as { id: string }).id;

      const other = await registerVerified(app, {
        email: uniqueEmail('other-author'),
        password: 'Password1!',
        fullName: 'Other Author',
        role: 'AUTHOR',
      });
      const otherToken = (other.body as { accessToken: string }).accessToken;
      await decide('approve', id, otherToken).expect(403);
      await decide('approve', id, sub.token).expect(403);
    });

    it('free course: enrolls with a zero amount', async () => {
      const free = await http()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Free',
          description: '',
          category: 'methods',
          priceCents: 0,
        })
        .expect(201);
      const freeId = (free.body as { id: string }).id;
      await http()
        .post(`/api/v1/courses/${freeId}/publish`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);

      const sub = await newSubscriber('free');
      const res = await pay(sub.token, 0, freeId).expect(200);
      expect((res.body as { status: string }).status).toBe('PAID');
    });
  });

  describe('cancelled by the student', () => {
    function cancel(token: string, course = courseId) {
      return http()
        .post(`/api/v1/courses/${course}/enrollments/cancel`)
        .set('Authorization', `Bearer ${token}`);
    }

    it('a submitted payment can be withdrawn; the admin can no longer approve it', async () => {
      const sub = await newSubscriber('cancel');
      const paid = await pay(sub.token, PRICE).expect(200);
      const id = (paid.body as { id: string }).id;

      const cancelled = await cancel(sub.token).expect(200);
      expect(cancelled.body).toMatchObject({
        id,
        status: 'CANCELLED',
        paidAmountCents: PRICE,
      });

      // Gone from the admin queue and no longer approvable.
      const queue = await http()
        .get('/api/v1/admin/enrollments/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((queue.body as { id: string }[]).map((e) => e.id)).not.toContain(
        id,
      );
      await decide('approve', id).expect(400);
      await decide('reject', id).expect(400);

      // Nothing to cancel twice.
      await cancel(sub.token).expect(400);

      const mine = await http()
        .get('/api/v1/me/enrollments')
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(200);
      expect(
        (mine.body as { id: string; status: string }[]).find((e) => e.id === id)
          ?.status,
      ).toBe('CANCELLED');

      await http()
        .get(`/api/v1/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(403);
    });

    it('buying again after a cancellation starts from the full price and can be approved', async () => {
      const sub = await newSubscriber('rebuy');
      const first = await pay(sub.token, 150_000).expect(200);
      const id = (first.body as { id: string }).id;
      await cancel(sub.token).expect(200);

      // A partial top-up is not enough: the cancelled amount does not carry over.
      const again = await pay(sub.token, PRICE).expect(200);
      expect(again.body).toMatchObject({
        id,
        status: 'PAID',
        paidAmountCents: PRICE,
        expectedAmountCents: PRICE,
      });

      const detail = await http()
        .get(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(200);
      expect(
        (detail.body as { myEnrollment: { status: string } }).myEnrollment
          .status,
      ).toBe('PAID');

      await decide('approve', id).expect(200);
      await http()
        .get(`/api/v1/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(200);

      // Granted access is not something the student cancels.
      await cancel(sub.token).expect(400);
    });

    it('a plain request (no payment) can be cancelled and re-requested', async () => {
      const sub = await newSubscriber('req-cancel');
      const requested = await http()
        .post(`/api/v1/courses/${courseId}/enrollments/request`)
        .set('Authorization', `Bearer ${sub.token}`)
        .send({ message: 'Интересует курс' })
        .expect(201);
      expect((requested.body as { status: string }).status).toBe('PENDING');

      await cancel(sub.token).expect(200);

      const reRequested = await http()
        .post(`/api/v1/courses/${courseId}/enrollments/request`)
        .set('Authorization', `Bearer ${sub.token}`)
        .send({})
        .expect(201);
      expect((reRequested.body as { status: string }).status).toBe('PENDING');
    });

    it('only the student cancels their own enrollment', async () => {
      const sub = await newSubscriber('cancel-guard');
      await cancel(sub.token).expect(404);
      await cancel(authorToken).expect(403);
      await cancel(adminToken).expect(403);
    });
  });

  describe('admin journal', () => {
    it('lists every enrollment with its history and filters by status', async () => {
      const sub = await newSubscriber('journal');
      const first = await pay(sub.token, 100_000).expect(200);
      const id = (first.body as { id: string }).id;
      await decide('request-more', id, adminToken, {
        note: 'Тағы 4 000 ₸',
      }).expect(200);

      // Underpaid requests do not vanish from the admin: they are in the journal.
      const underpaid = await http()
        .get('/api/v1/admin/enrollments?status=UNDERPAID')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const underpaidIds = (
        underpaid.body as { data: { id: string }[] }
      ).data.map((e) => e.id);
      expect(underpaidIds).toContain(id);

      await cancelAs(sub.token).expect(200);
      await pay(sub.token, PRICE).expect(200);
      await decide('approve', id).expect(200);

      const sold = await http()
        .get(`/api/v1/admin/enrollments?status=APPROVED&search=${sub.email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const rows = (
        sold.body as {
          data: {
            id: string;
            status: string;
            events: { type: string; amountCents?: number; note?: string }[];
          }[];
          meta: { total: number };
        }
      ).data;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(id);
      expect(rows[0].events.map((e) => e.type)).toEqual([
        'REQUESTED',
        'PAYMENT_SUBMITTED',
        'MORE_PAYMENT_REQUESTED',
        'CANCELLED',
        'PAYMENT_SUBMITTED',
        'APPROVED',
      ]);
      expect(rows[0].events[1].amountCents).toBe(100_000);
      expect(rows[0].events[2].note).toBe('Тағы 4 000 ₸');
      expect(rows[0].events[4].amountCents).toBe(PRICE);

      const stats = await http()
        .get('/api/v1/admin/enrollments/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = stats.body as {
        counts: Record<string, number>;
        soldRevenueCents: number;
      };
      expect(body.counts.APPROVED).toBeGreaterThanOrEqual(1);
      expect(body.soldRevenueCents).toBeGreaterThanOrEqual(PRICE);

      // Validation and access.
      await http()
        .get('/api/v1/admin/enrollments?status=NOPE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      await http()
        .get('/api/v1/admin/enrollments')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(403);
      await http()
        .get('/api/v1/admin/enrollments/stats')
        .set('Authorization', `Bearer ${sub.token}`)
        .expect(403);
    });
  });

  describe('actual amount differs from the declared one', () => {
    it('declared less than sent: the admin records the real amount and approves', async () => {
      const sub = await newSubscriber('declared-less');
      const paid = await pay(sub.token, 300_000).expect(200);
      const id = (paid.body as { id: string }).id;

      // Kaspi statement shows the full price arrived.
      const fixed = await decide('adjust-amount', id, adminToken, {
        receivedAmountCents: PRICE,
        note: 'По выписке 5 000 ₸',
      }).expect(200);
      expect(fixed.body).toMatchObject({
        status: 'PAID',
        paidAmountCents: PRICE,
        expectedAmountCents: PRICE,
      });
      await decide('approve', id).expect(200);
    });

    it('declared less, admin had already asked for more: correction makes it reviewable again', async () => {
      const sub = await newSubscriber('underpaid-fix');
      const paid = await pay(sub.token, 100_000).expect(200);
      const id = (paid.body as { id: string }).id;
      await decide('request-more', id, adminToken, {
        note: 'Не хватает',
      }).expect(200);

      const fixed = await decide('adjust-amount', id, adminToken, {
        receivedAmountCents: PRICE,
      }).expect(200);
      const body = fixed.body as { status: string; adminPaymentNote?: string };
      expect(body.status).toBe('PAID');
      expect(body.adminPaymentNote).toBeUndefined();

      // Still short after the correction: stays UNDERPAID with the note.
      const sub2 = await newSubscriber('still-short');
      const paid2 = await pay(sub2.token, 100_000).expect(200);
      const id2 = (paid2.body as { id: string }).id;
      await decide('request-more', id2, adminToken, {
        note: 'Не хватает',
      }).expect(200);
      const stillShort = await decide('adjust-amount', id2, adminToken, {
        receivedAmountCents: 200_000,
      }).expect(200);
      expect(stillShort.body).toMatchObject({
        status: 'UNDERPAID',
        paidAmountCents: 200_000,
        adminPaymentNote: 'Не хватает',
      });
    });

    it('sent more than the price: the overpayment is visible in the journal', async () => {
      const sub = await newSubscriber('overpaid');
      const paid = await pay(sub.token, PRICE).expect(200);
      const id = (paid.body as { id: string }).id;
      await decide('adjust-amount', id, adminToken, {
        receivedAmountCents: 600_000,
      }).expect(200);

      const journal = await http()
        .get(`/api/v1/admin/enrollments?search=${sub.email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const row = (
        journal.body as {
          data: {
            paidAmountCents: number;
            expectedAmountCents: number;
            events: {
              type: string;
              amountCents?: number;
              totalPaidCents?: number;
            }[];
          }[];
        }
      ).data[0];
      expect(row.paidAmountCents).toBe(600_000);
      expect(row.expectedAmountCents).toBe(PRICE);
      const adjusted = row.events.find((e) => e.type === 'AMOUNT_ADJUSTED')!;
      expect(adjusted.amountCents).toBe(100_000);
      expect(adjusted.totalPaidCents).toBe(600_000);

      // Validation and status rules.
      await decide('adjust-amount', id, adminToken, {
        receivedAmountCents: -1,
      }).expect(400);
      await decide('approve', id).expect(200);
      await decide('adjust-amount', id, adminToken, {
        receivedAmountCents: PRICE,
      }).expect(400);
    });
  });

  describe('journal filters', () => {
    it('filters sold courses by author and by date', async () => {
      const sub = await newSubscriber('filters');
      const paid = await pay(sub.token, PRICE).expect(200);
      await decide('approve', (paid.body as { id: string }).id).expect(200);

      const me = await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      const authorId = (me.body as { id: string }).id;
      const today = new Date().toISOString().slice(0, 10);

      const byAuthor = await http()
        .get(
          `/api/v1/admin/enrollments?status=APPROVED&authorId=${authorId}&dateFrom=${today}&dateTo=${today}&search=${sub.email}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((byAuthor.body as { meta: { total: number } }).meta.total).toBe(1);

      const otherAuthor = await http()
        .get(
          `/api/v1/admin/enrollments?status=APPROVED&authorId=nobody&search=${sub.email}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((otherAuthor.body as { meta: { total: number } }).meta.total).toBe(
        0,
      );

      const past = await http()
        .get(`/api/v1/admin/enrollments?dateTo=2000-01-01&search=${sub.email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((past.body as { meta: { total: number } }).meta.total).toBe(0);

      const stats = await http()
        .get(
          `/api/v1/admin/enrollments/stats?authorId=${authorId}&dateFrom=${today}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (stats.body as { soldRevenueCents: number }).soldRevenueCents,
      ).toBeGreaterThanOrEqual(PRICE);
      const none = await http()
        .get('/api/v1/admin/enrollments/stats?authorId=nobody')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((none.body as { soldRevenueCents: number }).soldRevenueCents).toBe(
        0,
      );

      await http()
        .get('/api/v1/admin/enrollments?dateFrom=not-a-date')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('course deletion', () => {
    it('a course with paid enrollments cannot be deleted', async () => {
      const res = await http()
        .delete(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(409);
      expect((res.body as { message: string }).message).toBe(
        'COURSE_HAS_PAID_ENROLLMENTS',
      );
    });
  });
});
