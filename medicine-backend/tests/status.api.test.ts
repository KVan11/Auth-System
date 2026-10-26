import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { databaseUnavailable } from '../src/errors.js';

const FRONTEND_ORIGIN = 'http://localhost:5173';
const SECRETS = /medicine_user|S3cret|db\.internal|28P01|ECONNREFUSED|password|SELECT/i;

const rawPgError = () =>
  Object.assign(new Error('password authentication failed for user "medicine_user" at db.internal'), {
    code: '28P01',
  });

const buildApp = (checkDatabase: () => Promise<void> = async () => {}) =>
  createApp({ checkDatabase, frontendOrigin: FRONTEND_ORIGIN });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/medicine/status', () => {
  it('reports a connected Medicine database after the probe succeeds', async () => {
    const checkDatabase = vi.fn(async () => {});

    const res = await request(buildApp(checkDatabase)).get('/api/medicine/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });

  it('returns a safe 503 and never claims success when the database is unavailable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildApp(async () => {
      throw databaseUnavailable(rawPgError());
    });

    const res = await request(app).get('/api/medicine/status');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu Medicine.' },
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).not.toMatch(SECRETS);
    // Log phía server chỉ có mã lỗi an toàn
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/medicine_user|S3cret|db\.internal|password/);
  });

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildApp(async () => {
      throw new Error('connect ECONNREFUSED db.internal:5432 password=S3cret');
    });

    const res = await request(app).get('/api/medicine/status');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } });
    expect(res.text).not.toMatch(SECRETS);
  });

  it('needs no identity and returns no identity or business payload', async () => {
    const anonymous = await request(buildApp()).get('/api/medicine/status');
    const withToken = await request(buildApp())
      .get('/api/medicine/status')
      .set('Authorization', 'Bearer some.jwt.token');

    expect(anonymous.status).toBe(200);
    expect(withToken.status).toBe(200);
    expect(withToken.body).toEqual(anonymous.body);
    expect(Object.keys(anonymous.body).sort()).toEqual(['database', 'status']);
    expect(withToken.text).not.toContain('some.jwt.token');
  });

  it('does not expose framework details', async () => {
    const res = await request(buildApp()).get('/api/medicine/status');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS for the existing frontend', () => {
  it('allows the configured frontend origin', async () => {
    const res = await request(buildApp()).get('/api/medicine/status').set('Origin', FRONTEND_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
  });

  it('does not allow other origins', async () => {
    const res = await request(buildApp()).get('/api/medicine/status').set('Origin', 'http://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('No business interface in M1', () => {
  it.each([
    ['get', '/api/medicine/subjects'],
    ['post', '/api/medicine/subjects/search'],
    ['get', '/api/medicine/tables/DEM-01'],
    ['post', '/api/medicine/query'],
    ['post', '/api/medicine/status'],
    ['get', '/'],
  ] as const)('%s %s returns a JSON 404', async (method, path) => {
    const checkDatabase = vi.fn(async () => {});

    const res = await request(buildApp(checkDatabase))[method](path).send({ sql: 'SELECT * FROM "DEM-01"' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API.' } });
    expect(checkDatabase).not.toHaveBeenCalled();
  });
});
