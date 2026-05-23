import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

describe('Subscriptions (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let authorToken: string;
  let subscriberToken: string;
  let subscriberId: string;
  let courseId: string;
  let lessonId: string;
  let subscriptionId: string;

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

    const authorEmail = `sub-author-${Date.now()}@test.local`;
    const authorRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: authorEmail,
        password: 'Password1!',
        fullName: 'Sub Author',
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
        email: `sub-user-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'Sub User',
        role: 'SUBSCRIBER',
      });
    subscriberId = (subRegister.body as { user: { id: string } }).user.id;
    subscriberToken = (subRegister.body as { accessToken: string }).accessToken;

    const courseRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Sub Course', description: 'For subscription test' });
    courseId = (courseRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`);

    const lessonRes = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Lesson 1', content: 'Premium content', orderNumber: 1 });
    lessonId = (lessonRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns null active subscription before grant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/subscription')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    expect(res.body).toBeNull();
  });

  it('subscriber cannot access lesson content without subscription', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(403);
  });

  it('admin grants subscription and subscriber gets access', async () => {
    const grantRes = await request(app.getHttpServer())
      .post('/api/v1/admin/subscriptions/grant')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: subscriberId,
        plan: 'BASIC',
        durationDays: 30,
      })
      .expect(201);

    subscriptionId = (grantRes.body as { id: string }).id;
    expect((grantRes.body as { isActive: boolean }).isActive).toBe(true);

    const active = await request(app.getHttpServer())
      .get('/api/v1/me/subscription')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    expect((active.body as { id: string }).id).toBe(subscriptionId);

    await request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);
  });

  it('revoke removes access immediately', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/subscriptions/${subscriptionId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(403);

    const active = await request(app.getHttpServer())
      .get('/api/v1/me/subscription')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    expect(active.body).toBeNull();
  });

  it('history lists revoked subscription', async () => {
    const history = await request(app.getHttpServer())
      .get('/api/v1/me/subscriptions')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const items = history.body as { status: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((s) => s.status === 'REVOKED')).toBe(true);
  });
});
