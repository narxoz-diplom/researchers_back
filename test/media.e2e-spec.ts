import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

describe('Media (e2e)', () => {
  let app: INestApplication<App>;
  let authorToken: string;
  let subscriberToken: string;
  let userId: string;

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
    const adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const authorEmail = `media-author-${Date.now()}@test.local`;
    const authorRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: authorEmail,
        password: 'Password1!',
        fullName: 'Media Author',
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
        email: `media-sub-${Date.now()}@test.local`,
        password: 'Password1!',
        fullName: 'Media Subscriber',
      });
    subscriberToken = (subRegister.body as { accessToken: string }).accessToken;
    userId = (subRegister.body as { user: { id: string } }).user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('subscriber cannot call /media/sign', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/sign')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .send({
        resourceType: 'image',
        folder: 'courses/test/cover',
      })
      .expect(403);
  });

  const signExpectation = cloudinaryConfigured ? 200 : 503;

  it('author receives signed upload params or 503 if Cloudinary unset', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/sign')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        resourceType: 'video',
        folder: 'courses/test-course/lessons/test-lesson/videos',
      })
      .expect(signExpectation);

    if (cloudinaryConfigured) {
      const body = res.body as {
        cloudName: string;
        apiKey: string;
        signature: string;
        timestamp: number;
        folder: string;
      };
      expect(body.cloudName).toBeTruthy();
      expect(body.apiKey).toBeTruthy();
      expect(body.signature).toBeTruthy();
      expect(body.timestamp).toBeGreaterThan(0);
      expect(body.folder).toBe(
        'courses/test-course/lessons/test-lesson/videos',
      );
      expect(JSON.stringify(body)).not.toContain('secret');
    }
  });

  it('any user can sign avatar upload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/sign/avatar')
      .set('Authorization', `Bearer ${subscriberToken}`)
      .expect(signExpectation);

    if (cloudinaryConfigured) {
      expect((res.body as { folder: string }).folder).toBe(`avatars/${userId}`);
      expect((res.body as { resourceType: string }).resourceType).toBe('image');
    }
  });
});
