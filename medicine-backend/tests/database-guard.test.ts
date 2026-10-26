import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  MARKER_PREFIX,
  openDisposableTestDatabase,
  readTestTarget,
  TestDatabaseGuardError,
} from './support/database.js';

const TEST_URL = 'postgresql://medicine_test:S3cret@localhost:5432/medicine_m2_test';
const MARKER = 'marker-for-tests-123';
const SECRETS = /S3cret|Hidden9|medicine_test|db\.internal/;

const env = (extra: Record<string, string> = {}) => ({
  MEDICINE_TEST_DATABASE_URL: TEST_URL,
  MEDICINE_TEST_DATABASE_MARKER: MARKER,
  ...extra,
});

// pool.query giả: trả về một dòng catalog (hoặc ném lỗi) để không cần database thật
const createFakePool = (query: () => Promise<unknown>) => {
  const pool = { query: vi.fn(query), end: vi.fn(async () => {}) };
  const factory = vi.fn((_config: pg.PoolConfig) => pool as unknown as Pick<pg.Pool, 'query' | 'end'>);
  return { pool, factory };
};
const catalogRow = (row: unknown) => createFakePool(async () => ({ rows: row ? [row] : [] }));

const guardError = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TestDatabaseGuardError);
    return (error as Error).message;
  }
  throw new Error('expected a TestDatabaseGuardError');
};

describe('readTestTarget', () => {
  it('reads the dedicated test URL and marker', () => {
    expect(readTestTarget(env())).toEqual({ url: TEST_URL, marker: MARKER });
  });

  it('requires a dedicated test URL and never falls back to the working Medicine database', () => {
    expect(guardError(() => readTestTarget({}))).toContain('MEDICINE_TEST_DATABASE_URL');
    expect(
      guardError(() =>
        readTestTarget({ MEDICINE_DATABASE_URL: TEST_URL, MEDICINE_TEST_DATABASE_MARKER: MARKER })
      )
    ).toContain('MEDICINE_TEST_DATABASE_URL');
  });

  it.each([undefined, '', 'short'])('requires a marker of at least 12 characters (%j)', (marker) => {
    const input: Record<string, string> = { MEDICINE_TEST_DATABASE_URL: TEST_URL };
    if (marker !== undefined) input.MEDICINE_TEST_DATABASE_MARKER = marker;
    expect(guardError(() => readTestTarget(input))).toContain('MEDICINE_TEST_DATABASE_MARKER');
  });

  it.each([
    ['the same URL', TEST_URL],
    ['127.0.0.1 for localhost', 'postgresql://other:Hidden9@127.0.0.1:5432/medicine_m2_test'],
    ['[::1] with the default port', 'postgres://other:Hidden9@[::1]/medicine_m2_test'],
  ])('rejects the working Medicine database given as %s, without revealing either URL', (_label, working) => {
    const message = guardError(() => readTestTarget(env({ MEDICINE_DATABASE_URL: working })));
    expect(message).toContain('trùng database Medicine');
    expect(message).not.toMatch(SECRETS);
  });

  it('accepts a different database on the same server', () => {
    const working = 'postgresql://medicine_user:Hidden9@localhost:5432/medicine';
    expect(() => readTestTarget(env({ MEDICINE_DATABASE_URL: working }))).not.toThrow();
  });

  it.each([
    ['not a URL', 'not a url :Hidden9'],
    ['a non-PostgreSQL URL', 'mysql://root:Hidden9@db.internal/medicine_m2_test'],
  ])('rejects %s without revealing it', (_label, url) => {
    const message = guardError(() => readTestTarget(env({ MEDICINE_TEST_DATABASE_URL: url })));
    expect(message).not.toMatch(SECRETS);
  });
});

describe('openDisposableTestDatabase', () => {
  it('returns the pool only when the marker matches and the role is not superuser', async () => {
    const fake = catalogRow({ marker: MARKER_PREFIX + MARKER, superuser: false });

    await expect(openDisposableTestDatabase(env(), fake.factory)).resolves.toBe(fake.pool);

    expect(fake.factory).toHaveBeenCalledWith(expect.objectContaining({ connectionString: TEST_URL }));
    expect(fake.pool.query).toHaveBeenCalledTimes(1);
    expect(fake.pool.end).not.toHaveBeenCalled();
  });

  it('only reads system catalogs to verify the target', async () => {
    const fake = catalogRow({ marker: MARKER_PREFIX + MARKER, superuser: false });

    await openDisposableTestDatabase(env(), fake.factory);

    const sql = (fake.pool.query.mock.calls[0] as unknown[])[0] as string;
    expect(sql).toMatch(/pg_database/);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i);
  });

  it.each([
    ['an unmarked database such as the Auth or working Medicine database', { marker: null, superuser: false }],
    ['a database with a different marker', { marker: `${MARKER_PREFIX}other-marker-xyz`, superuser: false }],
    ['a marker without the required prefix', { marker: MARKER, superuser: false }],
    ['a superuser role', { marker: MARKER_PREFIX + MARKER, superuser: true }],
    ['an empty catalog result', null],
  ])('refuses %s and closes the pool', async (_label, row) => {
    const fake = catalogRow(row);

    await expect(openDisposableTestDatabase(env(), fake.factory)).rejects.toBeInstanceOf(TestDatabaseGuardError);
    expect(fake.pool.end).toHaveBeenCalledTimes(1);
  });

  it('wraps connection failures without exposing driver details and closes the pool', async () => {
    const raw = Object.assign(new Error('password authentication failed for user "medicine_test"'), {
      code: '28P01',
    });
    const fake = createFakePool(async () => {
      throw raw;
    });

    const error = await openDisposableTestDatabase(env(), fake.factory).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TestDatabaseGuardError);
    expect((error as Error).message).not.toMatch(/medicine_test|password|28P01/);
    expect((error as Error).cause).toBe(raw);
    expect(fake.pool.end).toHaveBeenCalledTimes(1);
  });

  it('checks configuration before creating any pool', async () => {
    const fake = catalogRow({ marker: MARKER_PREFIX + MARKER, superuser: false });

    await expect(openDisposableTestDatabase({}, fake.factory)).rejects.toBeInstanceOf(TestDatabaseGuardError);
    expect(fake.factory).not.toHaveBeenCalled();
  });
});
