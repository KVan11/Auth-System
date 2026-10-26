import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/jwtSecret.js';
import { prisma } from '../lib/prisma.js';

export const ACCESS_TOKEN_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

const userWithPermissions = {
  role: {
    include: {
      permissions: true,
    },
  },
} as const;

type AuthUser = {
  id: number;
  role: { role_name: string; permissions: { permission_name: string }[] };
};

// Access token: JWT ngắn hạn, giữ nguyên các claim cũ (userId, role, permissions)
const signAccessToken = (user: AuthUser) => {
  const permissions = user.role.permissions.map((p) => p.permission_name);
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role.role_name, permissions },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
  return { accessToken, permissions };
};

// Refresh token: chuỗi ngẫu nhiên (không phải JWT), DB chỉ lưu SHA-256
export const hashRefreshToken = (refreshToken: string) =>
  crypto.createHash('sha256').update(refreshToken).digest('hex');

const createRefreshToken = async (userId: number) => {
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();

  // Dọn các refresh token đã hết hạn của user này
  await prisma.refreshToken.deleteMany({
    where: { user_id: userId, expires_at: { lt: now } },
  });
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashRefreshToken(refreshToken),
      expires_at: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return refreshToken;
};

// Hàm cấp token dùng chung cho mọi phương thức đăng nhập
export const issueTokens = async (user: AuthUser) => {
  const { accessToken, permissions } = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  return { accessToken, refreshToken, permissions };
};

export const refreshTokens = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new Error('Thiếu refresh token');
  }

  const record = await prisma.refreshToken.findUnique({
    where: { token_hash: hashRefreshToken(refreshToken) },
    include: { user: { include: userWithPermissions } },
  });

  if (!record || !record.user || record.expires_at <= new Date()) {
    throw new Error('Refresh token không hợp lệ hoặc đã hết hạn');
  }

  // Rotation: xoá token cũ; nếu đã bị dùng/xoá ở request khác thì từ chối
  const { count } = await prisma.refreshToken.deleteMany({ where: { id: record.id } });
  if (count !== 1) {
    throw new Error('Refresh token không hợp lệ hoặc đã hết hạn');
  }

  const tokens = await issueTokens(record.user);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

export const revokeRefreshToken = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new Error('Thiếu refresh token');
  }

  await prisma.refreshToken.deleteMany({
    where: { token_hash: hashRefreshToken(refreshToken) },
  });
};
