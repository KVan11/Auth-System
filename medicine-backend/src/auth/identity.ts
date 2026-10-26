import jwt from 'jsonwebtoken';
import { unauthenticated } from '../errors.js';

// Định danh tối thiểu Medicine cần; chỉ tồn tại trong phạm vi một request
export interface MedicineIdentity {
  userId: number;
  role: string;
}

export type VerifyIdentity = (authorization: string | undefined) => Promise<MedicineIdentity>;

// Chỉ nhận header đúng dạng Bearer token
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/;

const readIdentity = (payload: unknown): MedicineIdentity | undefined => {
  const claims = payload as { userId?: unknown; role?: unknown } | null;
  if (!claims || !Number.isSafeInteger(claims.userId) || (claims.userId as number) <= 0 || typeof claims.role !== 'string') {
    return undefined;
  }
  return { userId: claims.userId as number, role: claims.role };
};

// Tự xác minh access token bằng khoá dùng chung với Auth (JWT_SECRET, HS256), không gọi sang Auth.
// Medicine chỉ xác minh, không bao giờ ký token.
export const createJwtIdentityVerifier = (secret: string): VerifyIdentity => async (authorization) => {
  const token = authorization?.match(BEARER_PATTERN)?.[1];
  if (!token) throw unauthenticated();

  let payload: unknown;
  try {
    // Cố định HS256 để không chấp nhận token "none" hay thuật toán khác
    payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    // Sai chữ ký, hết hạn, sai định dạng: đều là chưa đăng nhập (frontend sẽ refresh)
    throw unauthenticated();
  }

  const identity = readIdentity(payload);
  if (!identity) throw unauthenticated();
  return identity;
};
