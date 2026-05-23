import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

describe('Courses (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let authorToken: string;
  let subscriberToken: string;
  let courseId: string;

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

    const authorEmail = `author-${Date.now()}@test.local`;
    const authorRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: authorEmail,
        password: 'Password1!',
        fullName: 'Course Author',
      });
    const authorId = (authorRegister.body as { user: { id: string } }).user.id;
    authorToken = (authorRegister.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${authorId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'AUTHOR' });

    const authorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: authorEmail, password: 'Password1!' });
    authorToken = (authorLogin.body as { accessToken: string }).accessToken;

    const subRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `sub-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'Subscriber',
      });
    subscriberToken = (subRegister.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('author creates, publishes, and lists own courses', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Test Course',
        description: 'Course description for e2e',
      })
      .expect(201);

    courseId = (createRes.body as { id: string }).id;
    expect((createRes.body as { status: string }).status).toBe('DRAFT');

    const catalogBefore = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);
    const idsBefore = (
      catalogBefore.body as { data: { id: string }[] }
    ).data.map((c) => c.id);
    expect(idsBefore).not.toContain(courseId);

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/courses/mine')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);
    expect((mine.body as { id: string }[]).some((c) => c.id === courseId)).toBe(
      true,
    );

    const catalogAfter = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);
    const idsAfter = (catalogAfter.body as { data: { id: string }[] }).data.map(
      (c) => c.id,
    );
    expect(idsAfter).toContain(courseId);
  });

  it('subscriber sees course without content access', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const body = res.body as {
      hasAccess: boolean;
      lessons: { content?: string }[];
    };
    expect(body.hasAccess).toBe(false);
    if (body.lessons.length > 0) {
      expect(body.lessons[0].content).toBeUndefined();
    }
  });

  it('author has full access to own course', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect((res.body as { hasAccess: boolean }).hasAccess).toBe(true);
  });

  it('subscriber cannot create courses', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({ title: 'Nope', description: 'Should fail' })
      .expect(403);
  });
});
