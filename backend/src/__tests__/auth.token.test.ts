import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Biến môi trường phải có trước khi các module được import
const env = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  return { secret: 'test-secret' };
});

// Prisma giả lập trong bộ nhớ: chỉ đủ cho User và RefreshToken
const db = vi.hoisted(() => {
  const role = {
    id: 2,
    role_name: 'user',
    permissions: [{ id: 1, role_id: 2, permission_name: 'read:profile' }],
  };
  const state = { users: [] as any[], refreshTokens: [] as any[], nextUserId: 1, nextTokenId: 1 };
  const withRole = (user: any) => (user ? { ...user, role } : null);
  const findUser = (where: Record<string, unknown>) =>
    state.users.find((u) => Object.entries(where).every(([k, v]) => u[k] === v));

  const prisma = {
    user: {
      findUnique: async ({ where }: any) => withRole(findUser(where)),
      update: async ({ where, data }: any) => withRole(Object.assign(findUser(where), data)),
      create: async ({ data }: any) => {
        const user = { id: state.nextUserId++, ...data };
        state.users.push(user);
        return withRole(user);
      },
    },
    refreshToken: {
      create: async ({ data }: any) => {
        const record = { id: state.nextTokenId++, created_date: new Date(), ...data };
        state.refreshTokens.push(record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        const record = state.refreshTokens.find((t) => t.token_hash === where.token_hash);
        if (!record) return null;
        return { ...record, user: withRole(state.users.find((u) => u.id === record.user_id)) };
      },
      deleteMany: async ({ where }: any) => {
        const matches = (t: any) =>
          (where.id === undefined || t.id === where.id) &&
          (where.token_hash === undefined || t.token_hash === where.token_hash) &&
          (where.user_id === undefined || t.user_id === where.user_id) &&
          (where.expires_at?.lt === undefined || t.expires_at < where.expires_at.lt);
        const before = state.refreshTokens.length;
        state.refreshTokens = state.refreshTokens.filter((t) => !matches(t));
        return { count: before - state.refreshTokens.length };
      },
    },
  };
  return { state, prisma };
});

const googleVerify = vi.hoisted(() => vi.fn());

vi.mock('../lib/prisma.js', () => ({ prisma: db.prisma }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = googleVerify;
  },
}));
vi.mock('../services/token.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/token.service.js')>();
  return { ...actual, issueTokens: vi.fn(actual.issueTokens) };
});

const { default: app } = await import('../app.js');
const { verifyToken, checkPermission } = await import('../middlewares/auth.middleware.js');
const TokenService = await import('../services/token.service.js');
const mockedIssueTokens = vi.mocked(TokenService.issueTokens);

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const protectedApp = express();
protectedApp.get('/protected', verifyToken, (req, res) => {
  res.json({ user: (req as any).user });
});
protectedApp.get('/needs-profile', verifyToken, checkPermission('read:profile'), (_req, res) => {
  res.json({ ok: true });
});
protectedApp.get('/needs-admin', verifyToken, checkPermission('admin:manage'), (_req, res) => {
  res.json({ ok: true });
});

const mockFetchText = (text: string) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => text, json: async () => ({}) })));
const mockFetchJson = (json: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => json, text: async () => '' })));

// Các phương thức đăng nhập thành công, mỗi cái tự chuẩn bị provider giả lập
const successfulLogins = {
  password: () => request(app).post('/api/auth/login').send({ email: 'a@gmail.com', password: '123456' }),
  google: () => {
    googleVerify.mockResolvedValue({
      getPayload: () => ({ sub: 'google-1', email: 'g@gmail.com', name: 'Google User' }),
    });
    return request(app).post('/api/auth/google').send({ token: 'google-id-token' });
  },
  facebook: () => {
    mockFetchJson({ id: 'fb-1', name: 'Fb User', email: 'fb@gmail.com' });
    return request(app).post('/api/auth/facebook').send({ token: 'fb-access-token' });
  },
  hust: () => {
    mockFetchText('1');
    return request(app)
      .post('/api/auth/hust')
      .send({ taikhoan: 'van.ntk@sis.hust.edu.vn', matkhau: 'hust-pw' });
  },
};

const loginWithPassword = async () => {
  const res = await successfulLogins.password();
  expect(res.status).toBe(200);
  return res.body as { accessToken: string; refreshToken: string };
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  db.state.users = [
    {
      id: 1,
      email: 'a@gmail.com',
      username: 'userA',
      password: await bcrypt.hash('123456', 4),
      role_id: 2,
    },
  ];
  db.state.refreshTokens = [];
  db.state.nextUserId = 2;
  db.state.nextTokenId = 1;
});

describe('Login issues access token + refresh token', () => {
  it.each(Object.keys(successfulLogins) as (keyof typeof successfulLogins)[])(
    '%s login returns accessToken + refreshToken via the shared issueTokens',
    async (method) => {
      const res = await successfulLogins[method]();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'Đăng nhập thành công',
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { id: expect.any(Number), email: expect.any(String), role: 'user', permissions: ['read:profile'] },
      });
      // alias tương thích ngược
      expect(res.body.token).toBe(res.body.accessToken);

      const claims = jwt.verify(res.body.accessToken, env.secret) as jwt.JwtPayload;
      expect(claims).toMatchObject({ userId: res.body.user.id, role: 'user', permissions: ['read:profile'] });
      expect(claims.exp! - claims.iat!).toBe(15 * 60);

      expect(mockedIssueTokens).toHaveBeenCalledTimes(1);
      expect(mockedIssueTokens.mock.calls[0]![0]).toMatchObject({ id: res.body.user.id });
    }
  );

  it('stores only the SHA-256 hash of the refresh token with a 7-day expiry', async () => {
    const { refreshToken } = await loginWithPassword();

    expect(db.state.refreshTokens).toHaveLength(1);
    const record = db.state.refreshTokens[0];
    expect(record.token_hash).toBe(sha256(refreshToken));
    expect(Object.values(record)).not.toContain(refreshToken);
    expect(record.user_id).toBe(1);
    const ttlDays = (record.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(ttlDays).toBeGreaterThan(6.99);
    expect(ttlDays).toBeLessThanOrEqual(7);
    // refresh token là chuỗi ngẫu nhiên, không phải JWT
    expect(jwt.decode(refreshToken)).toBeNull();
  });

  it.each([
    ['password', () => request(app).post('/api/auth/login').send({ email: 'a@gmail.com', password: 'wrong' })],
    ['google', () => {
      googleVerify.mockRejectedValue(new Error('Invalid Google token'));
      return request(app).post('/api/auth/google').send({ token: 'bad' });
    }],
    ['facebook', () => {
      mockFetchJson({ error: { message: 'Invalid OAuth access token' } });
      return request(app).post('/api/auth/facebook').send({ token: 'bad' });
    }],
    ['hust', () => {
      mockFetchText('0');
      return request(app).post('/api/auth/hust').send({ taikhoan: 'x@sis.hust.edu.vn', matkhau: 'bad' });
    }],
  ] as const)('failed %s login returns no tokens', async (_method, send) => {
    const res = await send();

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(db.state.refreshTokens).toHaveLength(0);
    expect(mockedIssueTokens).not.toHaveBeenCalled();
  });
});

describe('Access token on protected endpoints', () => {
  it('accepts a valid access token', async () => {
    const { accessToken } = await loginWithPassword();

    const res = await request(protectedApp).get('/protected').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId: 1, role: 'user' });
  });

  it('rejects a missing or invalid access token with 401', async () => {
    expect((await request(protectedApp).get('/protected')).status).toBe(401);

    const res = await request(protectedApp).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('rejects an expired access token with 401', async () => {
    const expired = jwt.sign(
      { userId: 1, role: 'user', permissions: [], exp: Math.floor(Date.now() / 1000) - 10 },
      env.secret
    );

    const res = await request(protectedApp).get('/protected').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Access token đã hết hạn' });
  });

  it('rejects a refresh token used as an access token', async () => {
    const { refreshToken } = await loginWithPassword();

    const res = await request(protectedApp).get('/protected').set('Authorization', `Bearer ${refreshToken}`);

    expect(res.status).toBe(401);
  });

  it('keeps permission checks working', async () => {
    const { accessToken } = await loginWithPassword();
    const auth = `Bearer ${accessToken}`;

    expect((await request(protectedApp).get('/needs-profile').set('Authorization', auth)).status).toBe(200);
    expect((await request(protectedApp).get('/needs-admin').set('Authorization', auth)).status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const { accessToken } = await loginWithPassword();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: 1, email: 'a@gmail.com', username: 'userA', role: 'user', permissions: ['read:profile'] },
    });
  });

  it('returns 401 without a valid access token so the client can refresh', async () => {
    const { refreshToken } = await loginWithPassword();

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshToken}`)).status
    ).toBe(401);
  });

  it('returns 404 when the user was deleted', async () => {
    const { accessToken } = await loginWithPassword();
    db.state.users = [];

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new access token and rotates the refresh token', async () => {
    const login = await loginWithPassword();

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(res.body.refreshToken).not.toBe(login.refreshToken);
    expect(jwt.verify(res.body.accessToken, env.secret)).toMatchObject({ userId: 1, role: 'user' });
    expect(db.state.refreshTokens.map((t) => t.token_hash)).toEqual([sha256(res.body.refreshToken)]);

    const protectedRes = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(protectedRes.status).toBe(200);
  });

  it('rejects the old refresh token after rotation', async () => {
    const login = await loginWithPassword();
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });
    expect(first.status).toBe(200);

    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });
    expect(reused.status).toBe(401);
    expect(reused.body.accessToken).toBeUndefined();

    const next = await request(app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(next.status).toBe(200);
  });

  it('rejects an expired refresh token', async () => {
    const login = await loginWithPassword();
    db.state.refreshTokens[0].expires_at = new Date(Date.now() - 1000);

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('rejects an unknown refresh token', async () => {
    await loginWithPassword();

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'unknown-token' });

    expect(res.status).toBe(401);
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    const login = await loginWithPassword();
    db.state.users = [];

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });

    expect(res.status).toBe(401);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the refresh token so it can no longer be refreshed', async () => {
    const login = await loginWithPassword();

    const res = await request(app).post('/api/auth/logout').send({ refreshToken: login.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Đăng xuất thành công' });
    expect(db.state.refreshTokens).toHaveLength(0);

    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: login.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('only revokes the given refresh token', async () => {
    const first = await loginWithPassword();
    const second = await loginWithPassword();

    await request(app).post('/api/auth/logout').send({ refreshToken: first.refreshToken });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: second.refreshToken });
    expect(res.status).toBe(200);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/logout').send({});

    expect(res.status).toBe(400);
  });
});
