// Kiểm tra token do Auth cấp bằng khoá dùng chung (MEDICINE_JWT_SECRET = JWT_SECRET của Auth).

import jwt from 'jsonwebtoken';
import { unauthenticated } from '../errors.js';

export interface MedicineIdentity {
  userId: number;
  role: string;
}

// Nhận header Authorization, trả về người dùng hoặc ném lỗi 401
export type VerifyIdentity = (authorization: string | undefined) => Promise<MedicineIdentity>;

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/;

const readIdentity = (payload: unknown): MedicineIdentity | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const { userId, role } = payload as { userId?: unknown; role?: unknown };
  if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0) return undefined;
  if (typeof role !== 'string') return undefined;

  return { userId, role };
};

export const createJwtIdentityVerifier = (secret: string): VerifyIdentity => {
  return async (authorization) => {
    const token = authorization?.match(BEARER_PATTERN)?.[1];
    if (!token) throw unauthenticated();

    let payload: unknown;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      throw unauthenticated(); // sai chữ ký hoặc hết hạn
    }

    const identity = readIdentity(payload);
    if (!identity) throw unauthenticated();
    return identity;
  };
};
