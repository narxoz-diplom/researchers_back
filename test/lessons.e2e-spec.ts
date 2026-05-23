import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

describe('Lessons (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let authorToken: string;
  let subscriberToken: string;
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

    const authorEmail = `lesson-author-${Date.now()}@test.local`;
    const authorRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: authorEmail,
        password: 'Password1!',
        fullName: 'Lesson Author',
        role: 'AUTHOR',
      });
    const authorId = (authorRegister.body as { user: { id: string } }).user.id;

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
        email: `lesson-sub-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'Lesson Subscriber',
        role: 'SUBSCRIBER',
      });
    subscriberToken = (subRegister.body as { accessToken: string }).accessToken;

    const courseRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Lessons Course',
        description: 'Course for lesson e2e tests',
      });
    courseId = (courseRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${authorToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('author creates lesson and subscriber lists without content', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Intro',
        content: 'Secret lesson content',
        orderNumber: 1,
      })
      .expect(201);

    lessonId = (createRes.body as { id: string }).id;

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(200);

    const list = listRes.body as {
      id: string;
      title: string;
      content?: string;
    }[];
    expect(list[0].title).toBe('Intro');
    expect(list[0].content).toBeUndefined();
  });

  it('subscriber gets 403 on lesson content without subscription', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(403);
  });

  it('author can read full lesson content', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);

    expect((res.body as { content: string }).content).toBe(
      'Secret lesson content',
    );
  });

  it('reorder lessons', async () => {
    const second = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ title: 'Second', orderNumber: 2 })
      .expect(201);

    const secondId = (second.body as { id: string }).id;

    const reordered = await request(app.getHttpServer())
      .patch(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        items: [
          { id: secondId, orderNumber: 1 },
          { id: lessonId, orderNumber: 2 },
        ],
      })
      .expect(200);

    const orders = (
      reordered.body as { id: string; orderNumber: number }[]
    ).map((l) => l.orderNumber);
    expect(orders).toEqual([1, 2]);
  });
});
