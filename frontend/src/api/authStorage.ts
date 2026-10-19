import type { AuthResponse, AuthTokens } from '../types/auth';

// Giữ nguyên cách lưu cũ (localStorage, key 'token' cho access token), bổ sung refresh token
const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const saveTokens = ({ accessToken, refreshToken }: AuthTokens) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

// Dùng chung cho mọi phương thức đăng nhập (email, Google, Facebook, HUST)
export const saveAuthSession = (data: AuthResponse) => {
  saveTokens(data);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
