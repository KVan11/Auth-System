// Tạo Express app (mở cổng ở index.ts). Express 5 tự bắt lỗi async nên route không cần try/catch.

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAccess } from './auth/access.js';
import type { VerifyIdentity } from './auth/identity.js';
import { errorCode, notFound, toErrorResponse } from './errors.js';
import type { VisitScheduleExport } from './modules/exports/visit-schedule/excel.js';
import { createVisitScheduleRouter } from './modules/exports/visit-schedule/routes.js';
import { createSearchRouter } from './modules/search/routes.js';
import type { SearchService } from './modules/search/types.js';

// index.ts truyền đồ thật, test truyền đồ giả
export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  verifyIdentity: VerifyIdentity;
  frontendOrigin: string;
  search: SearchService;
  visitSchedule: VisitScheduleExport;
}

export const createApp = ({ checkDatabase, verifyIdentity, frontendOrigin, search, visitSchedule }: AppDependencies) => {
  const app = express();
  app.disable('x-powered-by');

  // exposedHeaders: để frontend đọc được tên file Excel
  app.use(cors({ origin: [frontendOrigin], methods: ['GET'], exposedHeaders: ['Content-Disposition'] }));

  // Không cần đăng nhập vì không có dữ liệu bệnh nhân
  app.get('/api/medicine/status', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
  });

  app.get('/api/medicine/access', requireAccess(verifyIdentity, 'medicine.enter'), (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ access: 'granted' });
  });

  app.use('/api/medicine', createSearchRouter({ verifyIdentity, search }));
  app.use('/api/medicine', createVisitScheduleRouter({ verifyIdentity, search, visitSchedule }));

  app.use((_req, _res, next) => {
    next(notFound());
  });

  // Bộ xử lý lỗi (Express nhận ra nhờ đủ 4 tham số)
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const { status, body } = toErrorResponse(error);

    // Lỗi 5xx chỉ ghi mã lỗi gốc, không ghi chi tiết
    if (status >= 500) {
      const cause = error instanceof Error ? error.cause : undefined;
      const causeCode = errorCode(cause);
      const detail = causeCode ? ` (${causeCode})` : '';
      console.error(`Medicine API ${req.method} ${req.path} -> ${status} ${body.error.code}${detail}`);
    }

    res.status(status).json(body);
  });

  return app;
};
