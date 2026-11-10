import type { RequestHandler } from 'express';
import { forbidden } from '../errors.js';
import type { MedicineIdentity, VerifyIdentity } from './identity.js';

// Các thao tác cần bảo vệ
export type MedicineOperation = 'medicine.enter' | 'subject.search' | 'subject.view';

// Chỉ role ADMIN (so khớp chính xác)
const isAdmin = (identity: MedicineIdentity) => identity.role === 'ADMIN';

const DECISIONS: Record<MedicineOperation, (identity: MedicineIdentity) => boolean> = {
  'medicine.enter': isAdmin,
  'subject.search': isAdmin,
  'subject.view': isAdmin,
};

// Thao tác lạ thì từ chối
export const isAllowed = (identity: MedicineIdentity, operation: MedicineOperation) =>
  Object.hasOwn(DECISIONS, operation) && DECISIONS[operation](identity) === true;

// Xác minh token và kiểm tra quyền trước khi vào route
export const requireAccess =
  (verifyIdentity: VerifyIdentity, operation: MedicineOperation): RequestHandler =>
  async (req, res, next) => {
    const identity = await verifyIdentity(req.get('authorization'));
    if (!isAllowed(identity, operation)) throw forbidden();
    res.locals.identity = identity;
    next();
  };
