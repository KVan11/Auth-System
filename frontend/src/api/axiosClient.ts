import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens } from '../types/auth';
import { clearAuthSession, getAccessToken, getRefreshToken, saveTokens } from './authStorage';

const axiosClient = axios.create({
  // Use local Vite proxy by default so the UI talks to Express consistently in dev.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Các API này tự trả 401 khi sai thông tin đăng nhập, không được kích hoạt refresh
const NO_REFRESH_URLS = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/facebook',
  '/auth/hust',
  '/auth/refresh',
  '/auth/logout',
];

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

// Các request 401 cùng lúc dùng chung một lần refresh (refresh token bị xoay vòng sau mỗi lần dùng)
const refreshAccessToken = () => {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    const request = refreshToken
      ? axiosClient.post<AuthTokens>('/auth/refresh', { refreshToken }).then((res) => {
          saveTokens(res.data);
          return res.data.accessToken;
        })
      : Promise.reject(new Error('Missing refresh token'));
    refreshPromise = request.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const redirectToLogin = () => {
  clearAuthSession();
  if (window.location.pathname !== '/login') window.location.assign('/login');
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;
    const shouldRefresh =
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !NO_REFRESH_URLS.includes(config.url ?? '');

    if (!shouldRefresh) return Promise.reject(error);

    // Chỉ thử lại request gốc đúng một lần
    config._retry = true;
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken();
    } catch {
      redirectToLogin();
      return Promise.reject(error);
    }

    config.headers.Authorization = `Bearer ${accessToken}`;
    return axiosClient(config);
  }
);

export default axiosClient;
