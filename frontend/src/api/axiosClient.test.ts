// Test này tự giả lập localStorage/window nên chạy trong môi trường node
// @vitest-environment node
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from './axiosClient';
import { getAccessToken, getRefreshToken, saveAuthSession } from './authStorage';
import type { AuthResponse } from '../types/auth';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
};

type FakeRoute = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };

const calls: { url: string; authorization: string | undefined; body: unknown }[] = [];
let route: FakeRoute;

// Adapter giả thay cho HTTP thật: ghi lại request và trả response theo `route`
axiosClient.defaults.adapter = async (config) => {
  calls.push({
    url: config.url ?? '',
    authorization: config.headers.Authorization as string | undefined,
    body: config.data ? JSON.parse(config.data as string) : undefined,
  });
  const { status, data } = route(config);
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config };
  if (status >= 400) {
    throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
  }
  return response;
};

const loginResponse = (accessToken: string, refreshToken: string): AuthResponse => ({
  message: 'Đăng nhập thành công',
  accessToken,
  refreshToken,
  token: accessToken,
  user: { id: 1, email: 'a@gmail.com', username: 'userA', role: 'user', permissions: [] },
});

const urlsCalled = () => calls.map((c) => c.url);

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  calls.length = 0;
  assign = vi.fn();
  vi.stubGlobal('localStorage', createMemoryStorage());
  vi.stubGlobal('window', { location: { pathname: '/profile', assign } });
  saveAuthSession(loginResponse('access-1', 'refresh-1'));
});

describe('login storage', () => {
  it.each(['password', 'google', 'facebook', 'hust'])(
    'stores both tokens and the user after a %s login',
    (method) => {
      localStorage.clear();
      saveAuthSession(loginResponse(`${method}-access`, `${method}-refresh`));

      expect(getAccessToken()).toBe(`${method}-access`);
      expect(getRefreshToken()).toBe(`${method}-refresh`);
      expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ email: 'a@gmail.com' });
    }
  );
});

describe('axiosClient refresh flow', () => {
  it('sends the access token on authenticated requests', async () => {
    route = () => ({ status: 200, data: { ok: true } });

    await axiosClient.get('/medicines');

    expect(calls).toEqual([{ url: '/medicines', authorization: 'Bearer access-1', body: undefined }]);
  });

  it('refreshes once on 401 and retries the original request with the new access token', async () => {
    route = (config) => {
      if (config.url === '/auth/refresh') {
        return { status: 200, data: { accessToken: 'access-2', refreshToken: 'refresh-2' } };
      }
      return config.headers.Authorization === 'Bearer access-2'
        ? { status: 200, data: { ok: true } }
        : { status: 401, data: { error: 'Access token đã hết hạn' } };
    };

    const res = await axiosClient.get('/medicines');

    expect(res.data).toEqual({ ok: true });
    expect(urlsCalled()).toEqual(['/medicines', '/auth/refresh', '/medicines']);
    expect(calls[1]!.body).toEqual({ refreshToken: 'refresh-1' });
    expect(calls[2]!.authorization).toBe('Bearer access-2');
    expect(getAccessToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-2');
    expect(assign).not.toHaveBeenCalled();
  });

  it('clears auth and returns to login when refresh fails', async () => {
    route = (config) =>
      config.url === '/auth/refresh'
        ? { status: 401, data: { error: 'Refresh token không hợp lệ hoặc đã hết hạn' } }
        : { status: 401 };

    await expect(axiosClient.get('/medicines')).rejects.toMatchObject({ response: { status: 401 } });

    expect(urlsCalled()).toEqual(['/medicines', '/auth/refresh']);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('does not loop when the retried request is still unauthorized', async () => {
    route = (config) =>
      config.url === '/auth/refresh'
        ? { status: 200, data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }
        : { status: 401 };

    await expect(axiosClient.get('/medicines')).rejects.toMatchObject({ response: { status: 401 } });

    expect(urlsCalled()).toEqual(['/medicines', '/auth/refresh', '/medicines']);
  });

  it('does not refresh when a login request returns 401', async () => {
    route = () => ({ status: 401, data: { error: 'Mật khẩu sai' } });

    await expect(axiosClient.post('/auth/login', { email: 'a', password: 'b' })).rejects.toBeInstanceOf(AxiosError);

    expect(urlsCalled()).toEqual(['/auth/login']);
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('shares one refresh request between concurrent 401 responses', async () => {
    route = (config) => {
      if (config.url === '/auth/refresh') {
        return { status: 200, data: { accessToken: 'access-2', refreshToken: 'refresh-2' } };
      }
      return config.headers.Authorization === 'Bearer access-2' ? { status: 200, data: {} } : { status: 401 };
    };

    await Promise.all([axiosClient.get('/a'), axiosClient.get('/b')]);

    expect(urlsCalled().filter((url) => url === '/auth/refresh')).toHaveLength(1);
  });
});
