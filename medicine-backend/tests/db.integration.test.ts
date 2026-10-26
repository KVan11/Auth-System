import dotenv from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createMedicineDb } from '../src/db.js';
import { startServer, type RunningServer } from '../src/index.js';

// Opt-in: chỉ chạy bằng `npm run test:integration`, dùng MEDICINE_DATABASE_URL thật trong .env.
// Chỉ chạy câu SELECT 1 cố định qua db.ts; không đọc bảng nghiệp vụ, không ghi dữ liệu.
// Thiếu cấu hình thì test thất bại, không bỏ qua và không giả lập thành công.
dotenv.config({ quiet: true });

const config = loadConfig();
const running: RunningServer[] = [];

afterAll(async () => {
  await Promise.all(running.map((server) => server.close()));
});

describe('Medicine PostgreSQL connectivity (read-only)', () => {
  it('connects to the configured Medicine database with the fixed probe', async () => {
    const db = createMedicineDb(config.databaseUrl);
    try {
      await expect(db.checkConnection()).resolves.toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it('serves a connected status over real HTTP', async () => {
    const server = await startServer({
      config: { ...config, port: 0 },
      db: createMedicineDb(config.databaseUrl),
    });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/api/medicine/status`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' });
  });

  it('reports a safe failure for an unreachable target without leaking connection details', async () => {
    // Cùng thông tin đăng nhập nhưng trỏ tới cổng không có database
    const unreachable = new URL(config.databaseUrl);
    unreachable.hostname = '127.0.0.1';
    unreachable.port = '1';
    const server = await startServer({
      config: { ...config, port: 0 },
      db: createMedicineDb(unreachable.toString()),
    });
    running.push(server);
    const originalError = console.error;
    console.error = () => {};

    const res = await fetch(`http://127.0.0.1:${server.port}/api/medicine/status`);
    const text = await res.text();
    console.error = originalError;

    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({
      error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu Medicine.' },
    });
    const real = new URL(config.databaseUrl);
    for (const secret of [real.username, real.password, real.hostname, real.pathname.slice(1)]) {
      if (secret) expect(text).not.toContain(decodeURIComponent(secret));
    }
  });
});
