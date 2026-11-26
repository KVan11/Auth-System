// Khởi động server: đọc .env → kiểm tra cấu hình → kết nối database → mở cổng.

import { realpathSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createJwtIdentityVerifier } from './auth/identity.js';
import { ConfigError, loadConfig, type MedicineConfig } from './config.js';
import { createMedicineDb, type MedicineDb } from './db.js';
import { errorCode } from './errors.js';
import { createVisitScheduleExport } from './modules/exports/visit-schedule/excel.js';
import { createVisitScheduleRepository } from './modules/exports/visit-schedule/repository.js';
import { createSearchRepository } from './modules/search/repository.js';
import { createSearchService } from './modules/search/service.js';

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

// Test gọi hàm này với database giả
export const startServer = async ({ config, db }: { config: MedicineConfig; db: MedicineDb }): Promise<RunningServer> => {
  const search = createSearchService(createSearchRepository(db.pool));
  const visitSchedule = createVisitScheduleExport({
    repository: createVisitScheduleRepository(db.pool),
    python: config.pythonCommand,
  });
  const app = createApp({
    checkDatabase: () => db.checkConnection(),
    verifyIdentity: createJwtIdentityVerifier(config.jwtSecret),
    frontendOrigin: config.frontendOrigin,
    search,
    visitSchedule,
  });

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => {
      server.off('error', reject);
      resolve();
    });
  });

  // Gọi nhiều lần vẫn chỉ tắt một lần
  let closing: Promise<void> | undefined;
  const close = () => {
    if (closing === undefined) {
      closing = closeHttpServer(server).finally(() => db.close());
    }
    return closing;
  };

  // Test truyền cổng 0 để hệ điều hành tự chọn
  const { port } = server.address() as AddressInfo;
  return { port, close };
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

  // Database lỗi thì server vẫn chạy, API trả 503
  db.checkConnection().then(
    () => console.log('Medicine database: đã kết nối.'),
    () => console.error('Medicine database: không kết nối được (xem GET /api/medicine/status).')
  );

  // Ctrl+C hoặc lệnh dừng: tắt gọn rồi thoát
  const shutdown = () => {
    running.close().then(
      () => process.exit(0),
      () => process.exit(1)
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

// Chỉ chạy main() khi chạy trực tiếp, không chạy khi test import file này
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
    const code = errorCode(error);
    console.error(`Không khởi động được Medicine backend${code ? ` (${code})` : ''}.`);
    process.exit(1);
  });
}
