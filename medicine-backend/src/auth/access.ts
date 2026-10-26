import type { RequestHandler } from 'express';
import { forbidden } from '../errors.js';
import type { MedicineIdentity, VerifyIdentity } from './identity.js';

// Thao tác nghiệp vụ được bảo vệ (tên nội bộ, không phải tên quyền của Auth)
export type MedicineOperation = 'medicine.enter' | 'subject.search' | 'subject.view';

// Quyết định của chủ dự án (T017): chỉ role ADMIN, so khớp chính xác; không dùng mảng permissions
const isAdmin = (identity: MedicineIdentity) => identity.role === 'ADMIN';

const DECISIONS: Record<MedicineOperation, (identity: MedicineIdentity) => boolean> = {
  'medicine.enter': isAdmin,
  'subject.search': isAdmin,
  'subject.view': isAdmin,
};

// Thao tác không có trong bảng thì từ chối (fail closed)
export const isAllowed = (identity: MedicineIdentity, operation: MedicineOperation) =>
  Object.hasOwn(DECISIONS, operation) && DECISIONS[operation](identity) === true;

// Xác minh token rồi kiểm tra quyền, trước khi route chạm tới dữ liệu
export const requireAccess =
  (verifyIdentity: VerifyIdentity, operation: MedicineOperation): RequestHandler =>
  async (req, res, next) => {
    const identity = await verifyIdentity(req.get('authorization'));
    if (!isAllowed(identity, operation)) throw forbidden();
    res.locals.identity = identity;
    next();
  };
