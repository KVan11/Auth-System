// Kết nối PostgreSQL của Medicine qua pool (giữ sẵn kết nối để dùng lại).

import pg from 'pg';
import { databaseUnavailable } from './errors.js';

// Repository chỉ cần hàm query(), nên test dùng được pool giả
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface MedicineDb {
  checkConnection(): Promise<void>;
  close(): Promise<void>;
  readonly pool: Queryable;
}

type PoolLike = Pick<pg.Pool, 'query' | 'end' | 'on'>;
type PoolFactory = (config: pg.PoolConfig) => PoolLike;

const createPgPool: PoolFactory = (config) => new pg.Pool(config);

export const createMedicineDb = (databaseUrl: string, createPool: PoolFactory = createPgPool): MedicineDb => {
  // Chỉ kết nối khi có truy vấn đầu tiên
  const pool = createPool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  // Không bắt sự kiện này thì kết nối rảnh bị ngắt sẽ làm sập server
  pool.on('error', () => {
    console.error('Medicine database: kết nối rảnh bị ngắt.');
  });

  let closed = false;

  return {
    pool,

    async checkConnection() {
      try {
        await pool.query('SELECT 1');
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
