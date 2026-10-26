import pg from 'pg';

// Chỉ dùng cho test repository: mở pool tới database test dùng một lần,
// sau khi chắc chắn đó không phải database Medicine/Auth đang dùng.
// Không tạo schema hay fixture chung; SQL fixture thuộc về test của từng feature.
export class TestDatabaseGuardError extends Error {
  override name = 'TestDatabaseGuardError';
}

type Env = Record<string, string | undefined>;
type PoolLike = Pick<pg.Pool, 'query' | 'end'>;
type PoolFactory = (config: pg.PoolConfig) => PoolLike;

export const MARKER_PREFIX = 'medicine-disposable-test:';
const MIN_MARKER_LENGTH = 12;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Chỉ đọc catalog hệ thống, không đọc bảng nghiệp vụ
const IDENTITY_QUERY = `
  SELECT shobj_description(d.oid, 'pg_database') AS marker, r.rolsuper AS superuser
  FROM pg_database d, pg_roles r
  WHERE d.datname = current_database() AND r.rolname = current_user`;

const createPgPool: PoolFactory = (config) => new pg.Pool(config);

// Dạng host:port/database, coi các tên localhost là một; thông báo lỗi không chứa giá trị URL
const targetOf = (value: string, name: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TestDatabaseGuardError(`${name} không phải URL hợp lệ.`);
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new TestDatabaseGuardError(`${name} phải dùng giao thức postgres:// hoặc postgresql://.`);
  }
  const host = LOCAL_HOSTS.includes(url.hostname) ? 'localhost' : url.hostname.toLowerCase();
  return `${host}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
};

// Biến riêng cho test, không dùng MEDICINE_DATABASE_URL làm giá trị dự phòng
export const readTestTarget = (env: Env = process.env) => {
  const url = env.MEDICINE_TEST_DATABASE_URL?.trim();
  const marker = env.MEDICINE_TEST_DATABASE_MARKER?.trim();
  if (!url) {
    throw new TestDatabaseGuardError('Thiếu MEDICINE_TEST_DATABASE_URL (database test dùng một lần).');
  }
  if (!marker || marker.length < MIN_MARKER_LENGTH) {
    throw new TestDatabaseGuardError(`MEDICINE_TEST_DATABASE_MARKER phải có ít nhất ${MIN_MARKER_LENGTH} ký tự.`);
  }

  const target = targetOf(url, 'MEDICINE_TEST_DATABASE_URL');
  const working = env.MEDICINE_DATABASE_URL?.trim();
  if (working && targetOf(working, 'MEDICINE_DATABASE_URL') === target) {
    throw new TestDatabaseGuardError('MEDICINE_TEST_DATABASE_URL trỏ trùng database Medicine đang dùng.');
  }
  return { url, marker };
};

// Database phải được đánh dấu bằng COMMENT ON DATABASE ... IS 'medicine-disposable-test:<marker>'.
// Database Medicine/Auth thật không có dấu này nên luôn bị từ chối, kể cả khi URL trông khác.
export const openDisposableTestDatabase = async (
  env: Env = process.env,
  createPool: PoolFactory = createPgPool
): Promise<PoolLike> => {
  const { url, marker } = readTestTarget(env);
  const pool = createPool({ connectionString: url, max: 2, connectionTimeoutMillis: 5000 });

  try {
    const { rows } = await pool.query(IDENTITY_QUERY);
    const row = rows[0] as { marker: string | null; superuser: boolean } | undefined;
    if (row?.marker !== MARKER_PREFIX + marker) {
      throw new TestDatabaseGuardError(
        'Database test chưa được đánh dấu dùng một lần (COMMENT ON DATABASE không khớp).'
      );
    }
    if (row.superuser) {
      throw new TestDatabaseGuardError('Tài khoản database test không được là superuser.');
    }
  } catch (error) {
    await pool.end();
    if (error instanceof TestDatabaseGuardError) throw error;
    throw new TestDatabaseGuardError('Không kiểm tra được database test.', { cause: error });
  }
  return pool;
};
