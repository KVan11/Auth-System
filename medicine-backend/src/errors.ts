// Lỗi trả cho trình duyệt dạng { error: { code, message } }. Lỗi gốc chỉ giữ trong `cause`, không gửi đi.

export interface ErrorBody {
  error: { code: string; message: string };
}

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

// Chưa đăng nhập hoặc token sai/hết hạn
export const unauthenticated = () =>
  new AppError(401, 'MEDICINE_UNAUTHENTICATED', 'Bạn cần đăng nhập để dùng chức năng này.');

export const forbidden = () => new AppError(403, 'MEDICINE_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');

export const notFound = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy API.');

// subjectRef sai dạng hoặc không tồn tại đều trả như nhau
export const subjectNotFound = () => new AppError(404, 'MEDICINE_SUBJECT_NOT_FOUND', 'Không tìm thấy bệnh nhân.');

export const exportFailed = (cause?: unknown) =>
  new AppError(500, 'MEDICINE_EXPORT_FAILED', 'Không tạo được file Excel.', { cause });

export const databaseUnavailable = (cause?: unknown) =>
  new AppError(503, 'MEDICINE_DB_UNAVAILABLE', 'Không kết nối được cơ sở dữ liệu Medicine.', { cause });

// Lỗi không phải AppError → 500 chung chung
export const toErrorResponse = (error: unknown): { status: number; body: ErrorBody } => {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } },
  };
};

// Chỉ lấy mã lỗi (vd. ECONNREFUSED) để ghi log; thông báo có thể chứa mật khẩu
export const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};
