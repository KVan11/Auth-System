import pg from 'pg';
import { databaseUnavailable } from './errors.js';

// Pool hoặc client của pg
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface MedicineDb {
  checkConnection(): Promise<void>;
  close(): Promise<void>;
  // Cho repository dùng; không đưa ra API
  readonly pool: Queryable;
}

type PoolLike = Pick<pg.Pool, 'query' | 'end' | 'on'>;
type PoolFactory = (config: pg.PoolConfig) => PoolLike;

const CONNECTIVITY_PROBE = 'SELECT 1';

const createPgPool: PoolFactory = (config) => new pg.Pool(config);

export const createMedicineDb = (databaseUrl: string, createPool: PoolFactory = createPgPool): MedicineDb => {
  // Pool chỉ kết nối khi có truy vấn đầu tiên
  const pool = createPool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  // Bắt lỗi kết nối rảnh để process không bị sập
  pool.on('error', () => {
    console.error('Medicine database: kết nối rảnh bị ngắt.');
  });

  let closed = false;

  return {
    pool,
    async checkConnection() {
      try {
        await pool.query(CONNECTIVITY_PROBE);
      } catch (error) {
        throw databaseUnavailable(error);
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await pool.end();
    },
  };
};
