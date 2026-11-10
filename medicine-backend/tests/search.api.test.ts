import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createJwtIdentityVerifier } from '../src/auth/identity.js';
import { databaseUnavailable, subjectNotFound } from '../src/errors.js';
import { createSearchRepository } from '../src/modules/search/repository.js';
import { createSearchService } from '../src/modules/search/service.js';
import type { SearchService, SubjectCandidate } from '../src/modules/search/types.js';

// Test API danh sách và tổng quan bệnh nhân (chỉ ADMIN)

const SECRET = 'shared-test-secret';
const FRONTEND_ORIGIN = 'http://localhost:5173';
const SECRETS = /medicine_user|S3cret|db\.internal|28P01|ECONNREFUSED|password|SELECT|PTIDStore/i;

const tokenFor = (role: string, claims: Record<string, unknown> = {}, secret = SECRET) =>
  jwt.sign({ userId: 7, role, permissions: [], ...claims }, secret, { expiresIn: '15m' });
const ADMIN = `Bearer ${tokenFor('ADMIN')}`;

const CANDIDATES: SubjectCandidate[] = [
  { subjectRef: '20', ptid: '1000001A', ten: 'Nguyễn Văn A', ngaySinh: '1990-05-12' },
  { subjectRef: '21', ptid: '1000002B', ten: null, ngaySinh: null },
];

const createService = () => ({
  listSubjects: vi.fn<SearchService['listSubjects']>(async () => CANDIDATES),
  getSubject: vi.fn<SearchService['getSubject']>(async (subjectRef) => ({ subjectRef, ptid: '1000001A' })),
});

let service: ReturnType<typeof createService>;
const buildApp = (search: SearchService = service) =>
  createApp({
    checkDatabase: async () => {},
    verifyIdentity: createJwtIdentityVerifier(SECRET),
    frontendOrigin: FRONTEND_ORIGIN,
    search,
  });

// Lỗi giả giống lỗi thật của pg
const rawPgError = () =>
  Object.assign(new Error('connect ECONNREFUSED db.internal:5432 for medicine_user password S3cret'), {
    code: 'ECONNREFUSED',
  });

beforeEach(() => {
  service = createService();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/medicine/subjects', () => {
  it('returns every candidate to an ADMIN without caching', async () => {
    const res = await request(buildApp()).get('/api/medicine/subjects').set('Authorization', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: CANDIDATES });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(service.listSubjects).toHaveBeenCalledTimes(1);
    expect(service.listSubjects).toHaveBeenCalledWith();
  });

  it('ignores the query string: nothing the client sends reaches filtering, ordering or SQL', async () => {
    const res = await request(buildApp())
      .get('/api/medicine/subjects?ptid=1000001A&order=Ten&sql=DROP%20TABLE%20x&limit=1')
      .set('Authorization', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: CANDIDATES });
    expect(service.listSubjects).toHaveBeenCalledWith();
  });

  it('returns an empty list as success', async () => {
    service.listSubjects.mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/medicine/subjects').set('Authorization', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it.each([
    ['USER', `Bearer ${tokenFor('USER')}`],
    ['GUEST', `Bearer ${tokenFor('GUEST')}`],
    ['lowercase admin', `Bearer ${tokenFor('admin')}`],
    ['USER with unrelated permissions', `Bearer ${tokenFor('USER', { permissions: ['USER_VIEW'] })}`],
  ])('forbids %s before touching data', async (_label, header) => {
    const res = await request(buildApp()).get('/api/medicine/subjects').set('Authorization', header);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MEDICINE_FORBIDDEN');
    expect(service.listSubjects).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', undefined],
    ['a forged token', `Bearer ${tokenFor('ADMIN', {}, 'other-secret')}`],
    ['an expired token', `Bearer ${jwt.sign({ userId: 7, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET)}`],
  ])('returns 401 for %s before touching data', async (_label, header) => {
    const req = request(buildApp()).get('/api/medicine/subjects');
    const res = await (header ? req.set('Authorization', header) : req);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MEDICINE_UNAUTHENTICATED');
    expect(service.listSubjects).not.toHaveBeenCalled();
  });

  it('reports a database failure as 503, never as an empty list, without leaking details', async () => {
    const failingPool = { query: vi.fn(async () => Promise.reject(rawPgError())) };
    const app = buildApp(createSearchService(createSearchRepository(failingPool)));

    const res = await request(app).get('/api/medicine/subjects').set('Authorization', ADMIN);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu Medicine.' },
    });
    expect(res.body.items).toBeUndefined();
    expect(res.text).not.toMatch(SECRETS);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/S3cret|medicine_user|db\.internal/);
  });

  it('reports an unexpected failure as a safe 500', async () => {
    service.listSubjects.mockRejectedValue(new Error('boom at PTIDStore_g'));

    const res = await request(buildApp()).get('/api/medicine/subjects').set('Authorization', ADMIN);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } });
  });

  it('runs one fixed statement with no client-supplied values', async () => {
    const pool = { query: vi.fn(async (..._args: unknown[]) => ({ rows: [] })) };
    const app = buildApp(createSearchService(createSearchRepository(pool)));

    await request(app).get('/api/medicine/subjects?ptid=%27%3B%20DROP%20TABLE%20x').set('Authorization', ADMIN);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0]).toHaveLength(1);
    expect(pool.query.mock.calls[0]![0]).not.toContain('DROP');
  });
});

describe('GET /api/medicine/subjects/:subjectRef', () => {
  it('returns the selected subject overview to an ADMIN without caching', async () => {
    const res = await request(buildApp()).get('/api/medicine/subjects/20').set('Authorization', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subjectRef: '20', ptid: '1000001A' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(service.getSubject).toHaveBeenCalledWith('20');
  });

  it('returns 404 MEDICINE_SUBJECT_NOT_FOUND for a missing or out-of-scope subject', async () => {
    service.getSubject.mockRejectedValue(subjectNotFound());

    const res = await request(buildApp()).get('/api/medicine/subjects/30').set('Authorization', ADMIN);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'MEDICINE_SUBJECT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân.' } });
  });

  it.each(['abc', '0', '017', '2147483648', '1%20OR%201%3D1', '%27%3B%20DROP%20TABLE%20x'])(
    'answers 404 for malformed reference %s without querying the database',
    async (subjectRef) => {
      const pool = { query: vi.fn(async () => ({ rows: [{ id: 1, ptid: 'x' }] })) };
      const app = buildApp(createSearchService(createSearchRepository(pool)));

      const res = await request(app).get(`/api/medicine/subjects/${subjectRef}`).set('Authorization', ADMIN);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MEDICINE_SUBJECT_NOT_FOUND');
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  it('passes a valid reference to the fixed query as a parameter', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [{ id: 20, ptid: '1000001A' }] })) };
    const app = buildApp(createSearchService(createSearchRepository(pool)));

    const res = await request(app).get('/api/medicine/subjects/20').set('Authorization', ADMIN);

    expect(res.body).toEqual({ subjectRef: '20', ptid: '1000001A' });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('"ID" = $1'), [20]);
  });

  it('forbids a non-ADMIN before resolving the subject', async () => {
    const res = await request(buildApp())
      .get('/api/medicine/subjects/20')
      .set('Authorization', `Bearer ${tokenFor('USER')}`);

    expect(res.status).toBe(403);
    expect(service.getSubject).not.toHaveBeenCalled();
  });

  it('returns 401 without a token before resolving the subject', async () => {
    const res = await request(buildApp()).get('/api/medicine/subjects/20');

    expect(res.status).toBe(401);
    expect(service.getSubject).not.toHaveBeenCalled();
  });

  it('reports a database failure as 503 instead of "not found"', async () => {
    service.getSubject.mockRejectedValue(databaseUnavailable(rawPgError()));

    const res = await request(buildApp()).get('/api/medicine/subjects/20').set('Authorization', ADMIN);

    expect(res.status).toBe(503);
    expect(res.text).not.toMatch(SECRETS);
  });
});

describe('search routes expose reads only', () => {
  it.each([
    ['POST', '/api/medicine/subjects'],
    ['PUT', '/api/medicine/subjects/20'],
    ['DELETE', '/api/medicine/subjects/20'],
    ['GET', '/api/medicine/subjects/20/details'],
  ])('%s %s is not an endpoint', async (method, path) => {
    const res = await request(buildApp())[method.toLowerCase() as 'get'](path).set('Authorization', ADMIN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(service.listSubjects).not.toHaveBeenCalled();
    expect(service.getSubject).not.toHaveBeenCalled();
  });
});
