import jwt from 'jsonwebtoken';
import { unauthenticated } from '../errors.js';

// Thông tin người dùng lấy từ token
export interface MedicineIdentity {
  userId: number;
  role: string;
}

export type VerifyIdentity = (authorization: string | undefined) => Promise<MedicineIdentity>;

// Header dạng: Bearer <token>
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/;

const readIdentity = (payload: unknown): MedicineIdentity | undefined => {
  const claims = payload as { userId?: unknown; role?: unknown } | null;
  if (!claims || !Number.isSafeInteger(claims.userId) || (claims.userId as number) <= 0 || typeof claims.role !== 'string') {
    return undefined;
  }
  return { userId: claims.userId as number, role: claims.role };
};

// Xác minh token bằng khoá dùng chung với Auth; Medicine không ký token
export const createJwtIdentityVerifier = (secret: string): VerifyIdentity => async (authorization) => {
  const token = authorization?.match(BEARER_PATTERN)?.[1];
  if (!token) throw unauthenticated();

  let payload: unknown;
  try {
    // Chỉ chấp nhận HS256
    payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    // Token sai hoặc hết hạn → 401
    throw unauthenticated();
  }

  const identity = readIdentity(payload);
  if (!identity) throw unauthenticated();
  return identity;
};
