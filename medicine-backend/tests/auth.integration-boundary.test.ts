import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { isAllowed, type MedicineOperation } from '../src/auth/access.js';
import { createJwtIdentityVerifier } from '../src/auth/identity.js';
import { AppError } from '../src/errors.js';

// Quyết định T014 (dùng chung JWT_SECRET với Auth, HS256) và T017 (chỉ role ADMIN).
// Token được ký trong test giống cách Auth ký (backend/src/services/token.service.ts); không gọi Auth, không dùng database Auth.

const SECRET = 'shared-test-secret';
const FRONTEND_ORIGIN = 'http://localhost:5173';
const EXPIRED = () => Math.floor(Date.now() / 1000) - 60;

const sign = (claims: Record<string, unknown>, secret = SECRET, options: jwt.SignOptions = { expiresIn: '15m' }) =>
  jwt.sign(claims, secret, options);
// Cùng claim và hạn với access token của Auth
const tokenFor = (role: string, extra: Record<string, unknown> = {}) =>
  sign({ userId: 7, role, permissions: [], ...extra });
const bearer = (token: string) => `Bearer ${token}`;

// Đổi payload của token USER thành ADMIN nhưng giữ chữ ký cũ
const tamper = (token: string) => {
  const [header, , signature] = token.split('.');
  const payload = Buffer.from(JSON.stringify({ userId: 7, role: 'ADMIN' })).toString('base64url');
  return `${header}.${payload}.${signature}`;
};

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (error: unknown) => error as AppError
  );

describe('createJwtIdentityVerifier', () => {
  const verify = createJwtIdentityVerifier(SECRET);

  it('returns only the user id and role from a token signed with the shared secret', async () => {
    await expect(verify(bearer(tokenFor('ADMIN', { permissions: ['USER_VIEW'] })))).resolves.toEqual({
      userId: 7,
      role: 'ADMIN',
    });
  });

  it.each([
    ['no header', undefined],
    ['an empty header', ''],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['a lowercase scheme', `bearer ${tokenFor('ADMIN')}`],
    ['a missing token', 'Bearer '],
    ['a token with spaces', 'Bearer abc def'],
    ['a header injection attempt', `Bearer ${tokenFor('ADMIN')}\r\nX-Admin: 1`],
  ])('rejects %s as unauthenticated', async (_label, header) => {
    await expect(errorOf(verify(header))).resolves.toMatchObject({ status: 401, code: 'MEDICINE_UNAUTHENTICATED' });
  });

  it.each([
    ['a token signed with another secret', sign({ userId: 7, role: 'ADMIN' }, 'other-secret')],
    ['a token signed with the former default secret', sign({ userId: 7, role: 'ADMIN' }, 'secret_key')],
    ['an expired token', sign({ userId: 7, role: 'ADMIN', exp: EXPIRED() }, SECRET, {})],
    ['an unsigned token (alg none)', sign({ userId: 7, role: 'ADMIN' }, '', { algorithm: 'none' })],
    ['an HS512 token', sign({ userId: 7, role: 'ADMIN' }, SECRET, { algorithm: 'HS512' })],
    ['a tampered payload', tamper(tokenFor('USER'))],
    ['a refresh token (random string, not a JWT)', 'q2Xv8m0fJw3kZpQe1yT6uHn9rLs4aBcDeFgHiJkLmNo'],
    ['a string user id', sign({ userId: '7', role: 'ADMIN' })],
    ['a zero user id', sign({ userId: 0, role: 'ADMIN' })],
    ['a fractional user id', sign({ userId: 1.5, role: 'ADMIN' })],
    ['a missing role', sign({ userId: 7 })],
  ])('rejects %s as unauthenticated', async (_label, token) => {
    const error = await errorOf(verify(bearer(token)));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 401, code: 'MEDICINE_UNAUTHENTICATED' });
    expect(error.message).not.toContain(token);
  });
});

describe('isAllowed (T017: ADMIN only, same rule for all M2 operations)', () => {
  const operations: MedicineOperation[] = ['medicine.enter', 'subject.search', 'subject.view'];

  it.each(operations)('allows ADMIN to %s', (operation) => {
    expect(isAllowed({ userId: 1, role: 'ADMIN' }, operation)).toBe(true);
  });

  it.each(['USER', 'GUEST', 'admin', ' ADMIN', 'ADMIN ', ''])('denies role %j for every operation', (role) => {
    for (const operation of operations) {
      expect(isAllowed({ userId: 1, role }, operation)).toBe(false);
    }
  });

  it.each(['subject.update', 'export.download', 'toString', '__proto__'])('denies unknown operation %j', (operation) => {
    expect(isAllowed({ userId: 1, role: 'ADMIN' }, operation as MedicineOperation)).toBe(false);
  });
});

describe('GET /api/medicine/access', () => {
  const app = createApp({
    checkDatabase: async () => {},
    verifyIdentity: createJwtIdentityVerifier(SECRET),
    frontendOrigin: FRONTEND_ORIGIN,
  });

  it('grants entry to an ADMIN without returning identity details', async () => {
    const token = tokenFor('ADMIN');

    const res = await request(app).get('/api/medicine/access').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ access: 'granted' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).not.toContain(token);
  });

  it.each([
    ['USER (e.g. a newly registered account)', tokenFor('USER')],
    ['GUEST', tokenFor('GUEST')],
    ['USER holding unrelated Auth permissions', tokenFor('USER', { permissions: ['USER_VIEW', 'POST_DELETE'] })],
  ])('forbids %s', async (_label, token) => {
    const res = await request(app).get('/api/medicine/access').set('Authorization', bearer(token));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { code: 'MEDICINE_FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' },
    });
  });

  it.each([
    ['no token', undefined],
    ['an expired token', bearer(sign({ userId: 7, role: 'ADMIN', exp: EXPIRED() }, SECRET, {}))],
    ['a forged token', bearer(sign({ userId: 7, role: 'ADMIN' }, 'other-secret'))],
  ])('returns 401 for %s so the frontend can refresh', async (_label, header) => {
    const req = request(app).get('/api/medicine/access');
    const res = await (header ? req.set('Authorization', header) : req);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'Bạn cần đăng nhập để dùng chức năng này.' },
    });
  });

  it('lets the configured frontend send the Authorization header (CORS preflight)', async () => {
    const res = await request(app)
      .options('/api/medicine/access')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });
});

describe('Medicine only verifies Auth tokens', () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url));
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(join(dir, entry.name))
        : entry.name.endsWith('.ts')
          ? [join(dir, entry.name)]
          : []
    );

  it('never signs tokens and never reads Auth settings or database directly', () => {
    // Khoá chỉ đến từ MEDICINE_JWT_SECRET (config.ts); không ký token, không đọc DATABASE_URL của Auth
    const forbiddenUse = /jwt\.sign|(?:process\.)?env\.JWT_SECRET|(?<!MEDICINE_)DATABASE_URL/;
    for (const file of sourceFiles(srcDir)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(forbiddenUse);
    }
  });
});
