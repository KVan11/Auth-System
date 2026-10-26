import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { notFound, toErrorResponse } from './errors.js';

export interface AppDependencies {
  // Kiểm tra kết nối database
  checkDatabase: () => Promise<void>;
  frontendOrigin: string;
}

// Chỉ tạo app, không mở cổng; việc lắng nghe nằm ở index.ts
export const createApp = ({ checkDatabase, frontendOrigin }: AppDependencies) => {
  const app = express();
  app.disable('x-powered-by');
  // Dạng mảng: chỉ trả header CORS khi Origin của request đúng là frontend đã cấu hình
  app.use(cors({ origin: [frontendOrigin], methods: ['GET'] }));

  // endpoint duy nhất, không chứa dữ liệu nghiệp vụ và không cần đăng nhập
  app.get('/api/medicine/status', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
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
