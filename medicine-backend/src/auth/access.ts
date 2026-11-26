// Phân quyền theo thao tác. Hiện mọi thao tác chỉ cho ADMIN; đổi quyền thì sửa DECISIONS.

import type { RequestHandler } from 'express';
import { forbidden } from '../errors.js';
import type { MedicineIdentity, VerifyIdentity } from './identity.js';

export type MedicineOperation = 'medicine.enter' | 'subject.search' | 'subject.view' | 'export.visitSchedule';

// So khớp chính xác, 'admin' không được
const isAdmin = (identity: MedicineIdentity) => identity.role === 'ADMIN';

const DECISIONS: Record<MedicineOperation, (identity: MedicineIdentity) => boolean> = {
  'medicine.enter': isAdmin,
  'subject.search': isAdmin,
  'subject.view': isAdmin,
  'export.visitSchedule': isAdmin,
};

// Thao tác lạ thì từ chối; hasOwn để 'toString'... không bị coi là có trong bảng
export const isAllowed = (identity: MedicineIdentity, operation: MedicineOperation) => {
  if (!Object.hasOwn(DECISIONS, operation)) return false;
  return DECISIONS[operation](identity) === true;
};

// Middleware đặt trước route: sai token → 401, không đủ quyền → 403
export const requireAccess = (verifyIdentity: VerifyIdentity, operation: MedicineOperation): RequestHandler => {
  return async (req, res, next) => {
    const identity = await verifyIdentity(req.get('authorization'));
    if (!isAllowed(identity, operation)) throw forbidden();
    res.locals.identity = identity;
    next();
  };
};
