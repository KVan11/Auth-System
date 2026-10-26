import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createJwtIdentityVerifier } from './auth/identity.js';
import { ConfigError, loadConfig, type MedicineConfig } from './config.js';
import { createMedicineDb, type MedicineDb } from './db.js';

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

export const startServer = async ({ config, db }: { config: MedicineConfig; db: MedicineDb }): Promise<RunningServer> => {
  const app = createApp({
    checkDatabase: () => db.checkConnection(),
    verifyIdentity: createJwtIdentityVerifier(config.jwtSecret),
    frontendOrigin: config.frontendOrigin,
  });
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => {
      server.off('error', reject);
      resolve();
    });
  });

  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }).finally(() => db.close());
    return closing;
  };

  return { port: (server.address() as AddressInfo).port, close };
};

const main = async () => {
  dotenv.config({ quiet: true });

  let config: MedicineConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Cấu hình Medicine không hợp lệ: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const db = createMedicineDb(config.databaseUrl);
  const running = await startServer({ config, db });
  console.log(`Medicine backend đang chạy tại http://localhost:${running.port}`);

  // Kiểm tra kết nối lúc khởi động chỉ để báo trạng thái; server vẫn chạy nếu database lỗi
  db.checkConnection().then(
    () => console.log('Medicine database: đã kết nối.'),
    () => console.error('Medicine database: không kết nối được (xem GET /api/medicine/status).')
  );

  const shutdown = () => {
    running.close().then(
      () => process.exit(0),
      () => process.exit(1)
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

// Chỉ tự khởi động khi file này được chạy trực tiếp (không phải khi test import)
const isEntryPoint = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync.native(entry) === realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code;
    console.error(`Không khởi động được Medicine backend${typeof code === 'string' ? ` (${code})` : ''}.`);
    process.exit(1);
  });
}
