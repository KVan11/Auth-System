// Đọc cấu hình MEDICINE_* từ .env. Sai thì dừng lúc khởi động; không in giá trị ra (có thể chứa mật khẩu).

export interface MedicineConfig {
  databaseUrl: string;
  port: number;
  frontendOrigin: string;
  jwtSecret: string;
  pythonCommand: string;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Env = Record<string, string | undefined>;

const DEFAULT_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';

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

// Chỉ origin, ví dụ http://localhost:5173 (không có đường dẫn)
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

const readJwtSecret = (env: Env) => {
  const value = env.MEDICINE_JWT_SECRET?.trim();
  if (!value) {
    throw new ConfigError('Thiếu MEDICINE_JWT_SECRET (phải trùng JWT_SECRET của Auth backend).');
  }
  return value;
};

// Windows thường có `python`, Linux chỉ có `python3`
export const defaultPythonCommand = (platform: NodeJS.Platform = process.platform) =>
  platform === 'win32' ? 'python' : 'python3';

const readPythonCommand = (env: Env) => env.MEDICINE_PYTHON?.trim() || defaultPythonCommand();

// Test truyền `env` giả
export const loadConfig = (env: Env = process.env): MedicineConfig => ({
  databaseUrl: readDatabaseUrl(env),
  port: readPort(env),
  frontendOrigin: readFrontendOrigin(env),
  jwtSecret: readJwtSecret(env),
  pythonCommand: readPythonCommand(env),
});
