import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

describe('Progress (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let authorToken: string;
  let subscriberToken: string;
  let subscriberId: string;
  let courseId: string;
  let lessonId: string;

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

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@researchers.local',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
      });
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const authorEmail = `prog-author-${Date.now()}@test.local`;
    const authorRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: authorEmail,
        password: 'Password1!',
        fullName: 'Progress Author',
        role: 'AUTHOR',
      });
    const authorUserId = (authorRegister.body as { user: { id: string } }).user
      .id;

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${authorUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'AUTHOR' });

    const authorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: authorEmail, password: 'Password1!' });
    authorToken = (authorLogin.body as { accessToken: string }).accessToken;

    const subRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `prog-sub-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'Progress Subscriber',
        role: 'SUBSCRIBER',
      });
    subscriberId = (subRegister.body as { user: { id: string } }).user.id;
    subscriberToken = (subRegister.body as { accessToken: string }).accessToken;

    const courseRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Progress Course', description: 'Progress e2e' });
    courseId = (courseRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`);

    const lessonRes = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'L1', content: 'C1', orderNumber: 1 });
    const lesson2 = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'L2', content: 'C2', orderNumber: 2 });

    lessonId = (lessonRes.body as { id: string }).id;
    void (lesson2.body as { id: string }).id;

    const enrollmentRes = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/enrollments/request`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({});
    const enrollmentId = (enrollmentRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/enrollments/purchase`)
      .set('Authorization', `Bearer ${subscriberToken}`);

    await request(app.getHttpServer())
      .post(
        `/api/v1/courses/${courseId}/enrollments/${enrollmentId}/approve`,
      )
      .set('Authorization', `Bearer ${authorToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cannot complete without approved enrollment', async () => {
    const otherSub = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `no-sub-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'No Sub',
        role: 'SUBSCRIBER',
      });
    const token = (otherSub.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('marks lesson complete and reports 50% course progress', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const progress = await request(app.getHttpServer())
      .get(`/api/v1/me/progress?courseId=${courseId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const body = progress.body as {
      completedLessons: number;
      totalLessons: number;
      percentage: number;
    };
    expect(body.completedLessons).toBe(1);
    expect(body.totalLessons).toBe(2);
    expect(body.percentage).toBe(50);
  });

  it('complete is idempotent', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const progress = await request(app.getHttpServer())
      .get(`/api/v1/me/progress?courseId=${courseId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    expect(
      (progress.body as { completedLessons: number }).completedLessons,
    ).toBe(1);
  });

  it('uncomplete removes progress', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(204);

    const progress = await request(app.getHttpServer())
      .get(`/api/v1/me/progress?courseId=${courseId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    expect(
      (progress.body as { completedLessons: number }).completedLessons,
    ).toBe(0);
    expect((progress.body as { percentage: number }).percentage).toBe(0);
  });

  it('lists progress across courses', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${subscriberToken}`);

    const all = await request(app.getHttpServer())
      .get('/api/v1/me/progress')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const list = all.body as { courseId: string }[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((item) => item.courseId === courseId)).toBe(true);
  });
});
