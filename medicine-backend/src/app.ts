import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAccess } from './auth/access.js';
import type { VerifyIdentity } from './auth/identity.js';
import { notFound, toErrorResponse } from './errors.js';

export interface AppDependencies {
  // Kiểm tra kết nối database
  checkDatabase: () => Promise<void>;
  // Xác minh access token do Auth cấp (src/auth/identity.ts)
  verifyIdentity: VerifyIdentity;
  frontendOrigin: string;
}

// Chỉ tạo app, không mở cổng; việc lắng nghe nằm ở index.ts
export const createApp = ({ checkDatabase, verifyIdentity, frontendOrigin }: AppDependencies) => {
  const app = express();
  app.disable('x-powered-by');
  // Dạng mảng: chỉ trả header CORS khi Origin của request đúng là frontend đã cấu hình
  app.use(cors({ origin: [frontendOrigin], methods: ['GET'] }));

  // Không chứa dữ liệu nghiệp vụ nên không cần đăng nhập; ngoại lệ này không áp dụng cho endpoint nghiệp vụ
  app.get('/api/medicine/status', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
  });

  // Kiểm tra quyền vào khu vực Medicine; không trả định danh hay dữ liệu nghiệp vụ
  app.get('/api/medicine/access', requireAccess(verifyIdentity, 'medicine.enter'), (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ access: 'granted' });
  });

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
