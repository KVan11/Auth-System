export interface MedicineConfig {
  databaseUrl: string;
  port: number;
  frontendOrigin: string;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Env = Record<string, string | undefined>;

// Giá trị mặc định
const DEFAULT_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

// Thông báo lỗi không bao giờ chứa giá trị cấu hình (có thể chứa mật khẩu)
const readDatabaseUrl = (env: Env) => {
  const value = env.MEDICINE_DATABASE_URL?.trim();
  if (!value) {
    throw new ConfigError('Thiếu MEDICINE_DATABASE_URL (chuỗi kết nối database Medicine).');
  }

  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new ConfigError('MEDICINE_DATABASE_URL không phải URL hợp lệ.');
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new ConfigError('MEDICINE_DATABASE_URL phải dùng giao thức postgres:// hoặc postgresql://.');
  }
  return value;
};

const readPort = (env: Env) => {
  const value = env.MEDICINE_PORT;
  if (value === undefined) return DEFAULT_PORT;

  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new ConfigError('MEDICINE_PORT phải là số nguyên từ 1 đến 65535.');
  }
  return port;
};

const readFrontendOrigin = (env: Env) => {
  const value = env.MEDICINE_FRONTEND_ORIGIN;
  if (value === undefined) return DEFAULT_FRONTEND_ORIGIN;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError('MEDICINE_FRONTEND_ORIGIN không phải URL hợp lệ.');
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== value) {
    throw new ConfigError('MEDICINE_FRONTEND_ORIGIN phải là origin http(s), ví dụ http://localhost:5173.');
  }
  return value;
};

// Chỉ đọc cấu hình của Medicine
export const loadConfig = (env: Env = process.env): MedicineConfig => ({
  databaseUrl: readDatabaseUrl(env),
  port: readPort(env),
  frontendOrigin: readFrontendOrigin(env),
});
