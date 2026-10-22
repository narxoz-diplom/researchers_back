import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter';
import { registerVerified, SEED_ADMIN_EMAIL, tokensFor } from './helpers';

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
    const register = await registerVerified(app, {
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

  it('admin can update user profile', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Admin Updated' })
      .expect(200);

    expect((res.body as { fullName: string }).fullName).toBe('Admin Updated');
  });

  it('admin can reset user password', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewAdminPass1' })
      .expect(204);
  });

  it('non-admin cannot update another user', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fullName: 'Hacked' })
      .expect(403);
  });

  it('cannot downgrade the last admin', async () => {
    const admins = await request(app.getHttpServer())
      .get('/api/v1/users?role=ADMIN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const admin = (
      admins.body as { data: { id: string; email: string }[] }
    ).data.find((a) => a.email === SEED_ADMIN_EMAIL)!;

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUBSCRIBER' })
      .expect(409);
  });

  describe('email confirmation', () => {
    const email = `unverified-${Date.now()}@test.local`;

    it('without SMTP the signup returns the confirmation link for local testing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password1!',
          fullName: 'Not Yet',
          role: 'SUBSCRIBER',
        })
        .expect(201);
      const body = res.body as { message: string; devVerifyUrl?: string };
      expect(body.message).toBe('CHECK_EMAIL');
      expect(body.devVerifyUrl).toMatch(/\/auth\/verify-email\?token=/);

      const resent = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email })
        .expect(200);
      expect(
        (resent.body as { devVerifyUrl?: string }).devVerifyUrl,
      ).toBeTruthy();
    });

    it('an admin can confirm the email by hand; the user can then sign in', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(401);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/users?search=${email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const row = (
        list.body as { data: { id: string; emailVerified: boolean }[] }
      ).data[0];
      expect(row.emailVerified).toBe(false);

      const verified = await request(app.getHttpServer())
        .patch(`/api/v1/users/${row.id}/verify-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((verified.body as { emailVerified: boolean }).emailVerified).toBe(
        true,
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password1!' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${row.id}/verify-email`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('mail diagnostics', () => {
    it('admin test mail reports that SMTP is not configured; others are refused', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/mail/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(503);
      expect((res.body as { message: string }).message).toBe(
        'MAIL_NOT_CONFIGURED',
      );
      await request(app.getHttpServer())
        .post('/api/v1/admin/mail/test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      const health = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect((health.body as { checks: { mail: string } }).checks.mail).toBe(
        'not_configured',
      );
    });
  });

  describe('admins add other admins', () => {
    const email = `new-admin-${Date.now()}@test.local`;
    let newAdminId: string;

    it('POST /users creates a verified admin account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          fullName: 'Second Admin',
          password: 'AdminPass123!',
          role: 'ADMIN',
        })
        .expect(201);
      const body = res.body as { id: string; role: string; email: string };
      expect(body.role).toBe('ADMIN');
      expect(body.email).toBe(email);
      newAdminId = body.id;

      // Same email twice is refused.
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          fullName: 'Dup',
          password: 'AdminPass123!',
          role: 'ADMIN',
        })
        .expect(409);
    });

    it('the new admin can sign in without email confirmation and manage users', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'AdminPass123!' })
        .expect(200);
      const token = (login.body as { accessToken: string }).accessToken;

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // With two admins the seeded one is no longer "the last" and can be removed by the other.
      const seeded = await tokensFor(app, SEED_ADMIN_EMAIL);
      expect(seeded.user.role).toBe('ADMIN');
    });

    it('promoting an existing user to ADMIN and back works', async () => {
      const promoted = await request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ADMIN' })
        .expect(200);
      expect((promoted.body as { role: string }).role).toBe('ADMIN');

      const demoted = await request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUBSCRIBER' })
        .expect(200);
      expect((demoted.body as { role: string }).role).toBe('SUBSCRIBER');
    });

    it('non-admins cannot create accounts; validation guards the payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: `x-${Date.now()}@test.local`,
          fullName: 'X',
          password: 'AdminPass123!',
          role: 'ADMIN',
        })
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'not-an-email',
          fullName: 'X',
          password: 'short',
          role: 'ADMIN',
        })
        .expect(400);
    });

    afterAll(async () => {
      if (newAdminId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/users/${newAdminId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);
      }
    });
  });
});
