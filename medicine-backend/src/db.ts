import pg from 'pg';
import { databaseUnavailable } from './errors.js';

// chỉ kiểm tra kết nối
export interface MedicineDb {
  checkConnection(): Promise<void>;
  close(): Promise<void>;
}

type PoolLike = Pick<pg.Pool, 'query' | 'end' | 'on'>;
type PoolFactory = (config: pg.PoolConfig) => PoolLike;

const CONNECTIVITY_PROBE = 'SELECT 1';

const createPgPool: PoolFactory = (config) => new pg.Pool(config);

export const createMedicineDb = (databaseUrl: string, createPool: PoolFactory = createPgPool): MedicineDb => {
  // pg.Pool chỉ mở kết nối khi có truy vấn đầu tiên
  const pool = createPool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  // Client đang rảnh bị ngắt sẽ phát 'error'; không lắng nghe thì process bị sập
  pool.on('error', () => {
    console.error('Medicine database: kết nối rảnh bị ngắt.');
  });

  let closed = false;

  return {
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
