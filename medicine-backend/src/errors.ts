export interface ErrorBody {
  error: { code: string; message: string };
}

// Lỗi có kiểm soát: status, code và message đều an toàn để trả cho client
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

// Lỗi gốc của driver chỉ được giữ trong `cause`, không bao giờ trả cho client
export const databaseUnavailable = (cause?: unknown) =>
  new AppError(503, 'MEDICINE_DB_UNAVAILABLE', 'Không kết nối được cơ sở dữ liệu Medicine.', { cause });

export const notFound = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy API.');

export const unauthenticated = () =>
  new AppError(401, 'MEDICINE_UNAUTHENTICATED', 'Bạn cần đăng nhập để dùng chức năng này.');

export const forbidden = () => new AppError(403, 'MEDICINE_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');

export const toErrorResponse = (error: unknown): { status: number; body: ErrorBody } => {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } },
  };
};
