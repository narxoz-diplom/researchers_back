import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let userToken: string;
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
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const email = `users-${Date.now()}@test.local`;
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password1!',
        fullName: 'Users Test',
        role: 'SUBSCRIBER',
      });
    userToken = (register.body as { accessToken: string }).accessToken;
    userId = (register.body as { user: { id: string } }).user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/me returns profile with createdAt', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const body = res.body as { createdAt: string; fullName: string };
    expect(body.createdAt).toBeDefined();
    expect(body.fullName).toBe('Users Test');
  });

  it('PATCH /users/me updates profile', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fullName: 'Updated Name' })
      .expect(200);

    expect((res.body as { fullName: string }).fullName).toBe('Updated Name');
  });

  it('PATCH /users/me/password rejects wrong current password', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'wrong', newPassword: 'NewPass123' })
      .expect(401);
  });

  it('non-admin cannot list users', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('admin can list users and change role', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const listBody = list.body as {
      data: unknown[];
      meta: { total: number };
    };
    expect(listBody.data).toBeInstanceOf(Array);
    expect(listBody.meta.total).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'AUTHOR' })
      .expect(200);
  });

  it('cannot downgrade the last admin', async () => {
    const admins = await request(app.getHttpServer())
      .get('/api/v1/users?role=ADMIN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const admin = (admins.body as { data: { id: string }[] }).data[0];

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUBSCRIBER' })
      .expect(409);
  });
});
