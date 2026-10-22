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
  VALID_AUTHOR_APPLICATION,
} from './helpers';

describe('Author signup with offer and admin approval (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;

  const http = () => request(app.getHttpServer());

  async function signUpAuthor(email: string) {
    await http()
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password1!',
        fullName: 'Offer Author',
        role: 'AUTHOR',
        authorApplication: VALID_AUTHOR_APPLICATION,
      })
      .expect(201);
    // Signup sends a confirmation link; the test confirms it directly.
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password1!' })
      .expect(200);
    const body = login.body as {
      accessToken: string;
      user: { id: string; authorStatus?: string };
    };
    return { token: body.accessToken, user: body.user };
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('signup validation', () => {
    const base = () => ({
      email: uniqueEmail('offer'),
      password: 'Password1!',
      fullName: 'Offer Author',
      role: 'AUTHOR',
    });

    it('author signup without the offer is rejected', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send(base())
        .expect(400);
      expect((res.body as { message: string }).message).toBe(
        'AUTHOR_APPLICATION_REQUIRED',
      );
    });

    it('offer must be accepted', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send({
          ...base(),
          authorApplication: {
            ...VALID_AUTHOR_APPLICATION,
            acceptOffer: false,
          },
        })
        .expect(400);
    });

    it.each([
      ['iin', '12345'],
      ['phone', 'abc'],
      ['city', 'A'],
    ])('invalid %s is rejected', async (field, value) => {
      await http()
        .post('/api/v1/auth/register')
        .send({
          ...base(),
          authorApplication: { ...VALID_AUTHOR_APPLICATION, [field]: value },
        })
        .expect(400);
    });

    it('subscriber signup does not need an offer', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send({ ...base(), role: 'SUBSCRIBER' })
        .expect(201);
    });
  });

  describe('lifecycle', () => {
    let authorToken: string;
    let authorId: string;

    beforeAll(async () => {
      const author = await signUpAuthor(uniqueEmail('lifecycle'));
      authorToken = author.token;
      authorId = author.user.id;
      // No admin review: accepting the offer makes the author active at once.
      expect(author.user.authorStatus).toBe('APPROVED');
    });

    it('stores the offer (normalized IIN, city) and its version', async () => {
      const res = await http()
        .get('/api/v1/me/author-application')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      const body = res.body as {
        status: string;
        application: { city: string; iin: string; offerVersion: string };
      };
      expect(body.status).toBe('APPROVED');
      expect(body.application.iin).toBe('900101400123');
      expect(body.application.city).toBe('Алматы');
      expect(body.application.offerVersion).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(/iban|bankName|address|about/);
    });

    it('a new author creates courses right after signing up', async () => {
      await http()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'First course', description: '', category: 'methods' })
        .expect(201);
    });

    it('authors cannot edit the landing section texts (site copy is admin-only)', async () => {
      const payload = {
        description: 'x',
        points: ['x'],
        descriptionKk: 'x',
        pointsKk: ['x'],
      };
      await http()
        .patch('/api/v1/landing-sections/methods')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(payload)
        .expect(403);
      await http()
        .patch('/api/v1/landing-sections/methods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);
    });

    it('author sees the studio list and profile settings', async () => {
      await http()
        .get('/api/v1/courses/mine')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      await http()
        .get('/api/v1/users/me/ai-settings')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
    });

    it('only admins review authors', async () => {
      await http()
        .get('/api/v1/admin/authors')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(403);
      await http()
        .post(`/api/v1/admin/authors/${authorId}/approve`)
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(403);
    });

    it('admin lists authors with their offer', async () => {
      const res = await http()
        .get('/api/v1/admin/authors?status=APPROVED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const row = (
        res.body as { id: string; application?: { legalName: string } }[]
      ).find((a) => a.id === authorId);
      expect(row?.application?.legalName).toBe(
        VALID_AUTHOR_APPLICATION.legalName,
      );

      await http()
        .get('/api/v1/admin/authors?status=NOPE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('revocation needs a note and locks course management', async () => {
      await http()
        .post(`/api/v1/admin/authors/${authorId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      const res = await http()
        .post(`/api/v1/admin/authors/${authorId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'ЖСН тексеріңіз' })
        .expect(200);
      expect((res.body as { status: string }).status).toBe('REJECTED');

      const course = await http()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Locked', description: '', category: 'methods' })
        .expect(403);
      expect((course.body as { message: string }).message).toBe(
        'AUTHOR_NOT_APPROVED',
      );

      const mine = await http()
        .get('/api/v1/me/author-application')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect(
        (mine.body as { application: { reviewNote: string } }).application
          .reviewNote,
      ).toBe('ЖСН тексеріңіз');
    });

    it('rejected author resubmits and is pending again', async () => {
      const res = await http()
        .put('/api/v1/me/author-application')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ ...VALID_AUTHOR_APPLICATION, city: 'Астана' })
        .expect(200);
      const body = res.body as {
        status: string;
        application: { city: string; reviewNote?: string };
      };
      expect(body.status).toBe('PENDING');
      expect(body.application.city).toBe('Астана');
      expect(body.application.reviewNote).toBeUndefined();

      // A resubmission after revocation does wait for the admin.
      await http()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Still locked', description: '', category: 'methods' })
        .expect(403);
    });

    it('approved author creates courses; approving twice is refused', async () => {
      const res = await http()
        .post(`/api/v1/admin/authors/${authorId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((res.body as { status: string }).status).toBe('APPROVED');

      await http()
        .post(`/api/v1/admin/authors/${authorId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Same access token: the status is checked live, not baked into the JWT.
      await http()
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Approved course',
          description: '',
          category: 'methods',
        })
        .expect(201);

      const me = await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      expect((me.body as { authorStatus: string }).authorStatus).toBe(
        'APPROVED',
      );
    });

    it('approved author cannot rewrite the accepted offer', async () => {
      await http()
        .put('/api/v1/me/author-application')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(VALID_AUTHOR_APPLICATION)
        .expect(400);
    });

    it('revoking an author locks their existing courses', async () => {
      const mine = await http()
        .get('/api/v1/courses/mine')
        .set('Authorization', `Bearer ${authorToken}`)
        .expect(200);
      const courseId = (mine.body as { id: string }[])[0].id;

      await http()
        .post(`/api/v1/admin/authors/${authorId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Оферта шарттары бұзылды' })
        .expect(200);

      await http()
        .patch(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'Renamed' })
        .expect(403);
      await http()
        .post(`/api/v1/courses/${courseId}/lessons`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ title: 'L', orderNumber: 1 })
        .expect(403);
    });
  });

  describe('admin role changes', () => {
    it('promoting a subscriber to author approves them; demoting clears it', async () => {
      const sub = await registerVerified(app, {
        email: uniqueEmail('promote'),
        password: 'Password1!',
        fullName: 'Promoted',
        role: 'SUBSCRIBER',
      });
      const userId = (sub.body as { user: { id: string } }).user.id;

      const promoted = await http()
        .patch(`/api/v1/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'AUTHOR' })
        .expect(200);
      expect((promoted.body as { authorStatus: string }).authorStatus).toBe(
        'APPROVED',
      );

      const demoted = await http()
        .patch(`/api/v1/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUBSCRIBER' })
        .expect(200);
      expect(
        (demoted.body as { authorStatus?: string }).authorStatus,
      ).toBeUndefined();
    });
  });
});
