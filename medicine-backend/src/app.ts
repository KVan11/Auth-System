import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAccess } from './auth/access.js';
import type { VerifyIdentity } from './auth/identity.js';
import { notFound, toErrorResponse } from './errors.js';
import { createSearchRouter } from './modules/search/routes.js';
import type { SearchService } from './modules/search/types.js';

export interface AppDependencies {
  // Kiểm tra kết nối database
  checkDatabase: () => Promise<void>;
  // Xác minh token của Auth
  verifyIdentity: VerifyIdentity;
  frontendOrigin: string;
  // Danh sách và tổng quan bệnh nhân
  search: SearchService;
}

// Chỉ tạo app; mở cổng ở index.ts
export const createApp = ({ checkDatabase, verifyIdentity, frontendOrigin, search }: AppDependencies) => {
  const app = express();
  app.disable('x-powered-by');
  // Chỉ cho phép origin của frontend
  app.use(cors({ origin: [frontendOrigin], methods: ['GET'] }));

  // Không cần đăng nhập (không có dữ liệu nghiệp vụ)
  app.get('/api/medicine/status', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
  });

  // Kiểm tra quyền vào Medicine
  app.get('/api/medicine/access', requireAccess(verifyIdentity, 'medicine.enter'), (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ access: 'granted' });
  });

  app.use('/api/medicine', createSearchRouter({ verifyIdentity, search }));

  app.use((_req, _res, next) => {
    next(notFound());
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const { status, body } = toErrorResponse(error);
    if (status >= 500) {
      // Chỉ log mã lỗi
      const causeCode = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
      const detail = typeof causeCode === 'string' ? ` (${causeCode})` : '';
      console.error(`Medicine API ${req.method} ${req.path} -> ${status} ${body.error.code}${detail}`);
    }
    res.status(status).json(body);
  });

  return app;
};
