import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';

// pg.Pool giả: ghi lại mọi câu lệnh để chứng minh chỉ có SELECT 1
const pgMock = vi.hoisted(() => ({
  Pool: vi.fn(function () {
    return { query: vi.fn(), end: vi.fn(), on: vi.fn() };
  }),
}));
vi.mock('pg', () => ({ default: pgMock }));

const { createMedicineDb } = await import('../src/db.js');

const URL = 'postgresql://medicine_user:S3cret@db.internal:5432/medicine';

const createFakePool = (query: (sql: string) => Promise<unknown> = async () => ({ rows: [{ '?column?': 1 }] })) => {
  const calls: unknown[][] = [];
  const listeners: Record<string, (error: Error) => void> = {};
  const pool = {
    query: vi.fn(async (...args: unknown[]) => {
      calls.push(args);
      return query(args[0] as string);
    }),
    end: vi.fn(async () => {}),
    on: vi.fn((event: string, listener: (error: Error) => void) => {
      listeners[event] = listener;
      return pool;
    }),
  };
  return { pool, calls, listeners, factory: vi.fn(() => pool) };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMedicineDb', () => {
  it('does not create a pool or connect when the module is imported', () => {
    expect(pgMock.Pool).not.toHaveBeenCalled();
  });

  it('creates the pg pool from the Medicine connection URL only when asked', () => {
    createMedicineDb(URL);

    expect(pgMock.Pool).toHaveBeenCalledTimes(1);
    expect(pgMock.Pool.mock.calls[0]![0]).toMatchObject({ connectionString: URL });
  });

  it('resolves when the fixed SELECT 1 probe succeeds', async () => {
    const fake = createFakePool();
    const db = createMedicineDb(URL, fake.factory);

    await expect(db.checkConnection()).resolves.toBeUndefined();
    expect(fake.calls).toEqual([['SELECT 1']]);
  });

  it('rejects with a safe MEDICINE_DB_UNAVAILABLE error when the probe fails', async () => {
    const raw = Object.assign(new Error('password authentication failed for user "medicine_user"'), {
      code: '28P01',
    });
    const fake = createFakePool(async () => {
      throw raw;
    });
    const db = createMedicineDb(URL, fake.factory);

    const error = await db.checkConnection().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 503, code: 'MEDICINE_DB_UNAVAILABLE' });
    expect((error as AppError).message).not.toMatch(/medicine_user|password|28P01|S3cret/);
    // Lỗi gốc chỉ được giữ nội bộ
    expect((error as AppError).cause).toBe(raw);
  });

  it('only ever runs the fixed probe and accepts no caller SQL', async () => {
    const fake = createFakePool();
    const db = createMedicineDb(URL, fake.factory);

    expect(Object.keys(db).sort()).toEqual(['checkConnection', 'close']);
    expect(db.checkConnection.length).toBe(0);

    await db.checkConnection();
    // Tham số thừa bị bỏ qua: không thể chèn câu lệnh khác
    await (db.checkConnection as (...args: unknown[]) => Promise<void>)('DROP TABLE "DEM-01"', ['x']);

    expect(fake.calls).toEqual([['SELECT 1'], ['SELECT 1']]);
    // Không truy vấn bảng nghiệp vụ, không thay đổi schema hay dữ liệu
    for (const [sql] of fake.calls) {
      expect(sql).not.toMatch(/\b(FROM|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i);
    }
  });

  it('closes the pool once and ignores repeated close calls', async () => {
    const fake = createFakePool();
    const db = createMedicineDb(URL, fake.factory);

    await db.close();
    await db.close();

    expect(fake.pool.end).toHaveBeenCalledTimes(1);
  });

  it('handles idle pool errors without crashing or logging connection details', () => {
    const fake = createFakePool();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMedicineDb(URL, fake.factory);

    expect(fake.pool.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(() =>
      fake.listeners.error!(new Error('terminating connection for medicine_user at db.internal'))
    ).not.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/medicine_user|db\.internal|S3cret/);

    log.mockRestore();
  });
});
