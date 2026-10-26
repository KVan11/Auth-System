import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToLogin, refreshAccessToken } from '../../src/api/axiosClient';
import medicineApi, { describeMedicineError, isMedicineForbidden, medicineClient } from '../../src/api/medicineApi';

// Cơ chế refresh của Auth được giả lập; test chỉ kiểm tra Medicine dùng chung nó đúng cách
vi.mock('../../src/api/axiosClient', () => ({
  default: {},
  refreshAccessToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));
const refresh = vi.mocked(refreshAccessToken);
const redirect = vi.mocked(redirectToLogin);

type Reply = { status: number; data?: unknown } | 'network-error';

const requests: InternalAxiosRequestConfig[] = [];
let reply: Reply;
// Nếu có, các phản hồi trong hàng đợi được dùng trước `reply` (cho luồng 401 → refresh → thử lại)
let queued: Reply[] = [];

// Adapter giả thay cho HTTP thật
medicineClient.defaults.adapter = async (config) => {
  requests.push(config);
  const reply = queued.shift() ?? currentReply();
  if (reply === 'network-error') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  }
  const response: AxiosResponse = { status: reply.status, data: reply.data, statusText: '', headers: {}, config };
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, response);
  }
  return response;
};
const currentReply = () => reply;

const failureOf = (promise: Promise<unknown>) => promise.then(
  () => { throw new Error('expected failure'); },
  (error: unknown) => error
);

beforeEach(() => {
  requests.length = 0;
  queued = [];
  localStorage.clear();
  refresh.mockReset();
  redirect.mockReset();
});

const authorizationOf = (index: number) => requests[index]!.headers.Authorization;

describe('medicineApi.checkAccess', () => {
  const GRANTED = { status: 200, data: { access: 'granted' } };

  it('sends the stored Auth access token to the Medicine access endpoint', async () => {
    localStorage.setItem('token', 'access-1');
    reply = GRANTED;

    await expect(medicineApi.checkAccess()).resolves.toBeUndefined();

    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe('/access');
    expect(requests[0]!.method).toBe('get');
    expect(authorizationOf(0)).toBe('Bearer access-1');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes through Auth on 401 and retries once with the new token', async () => {
    localStorage.setItem('token', 'expired');
    refresh.mockResolvedValue('access-2');
    queued = [{ status: 401, data: { error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'x' } } }];
    reply = GRANTED;

    await medicineApi.checkAccess();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests.map((_, i) => authorizationOf(i))).toEqual(['Bearer expired', 'Bearer access-2']);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('goes to login when the session cannot be refreshed', async () => {
    refresh.mockRejectedValue(new Error('Missing refresh token'));
    reply = { status: 401, data: { error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'x' } } };

    await failureOf(medicineApi.checkAccess());

    expect(authorizationOf(0)).toBeUndefined();
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });

  it('goes to login when Medicine still rejects the refreshed token', async () => {
    localStorage.setItem('token', 'expired');
    refresh.mockResolvedValue('access-2');
    reply = { status: 401, data: { error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'x' } } };

    await failureOf(medicineApi.checkAccess());

    expect(requests).toHaveLength(2);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('reports a forbidden account without refreshing or redirecting', async () => {
    localStorage.setItem('token', 'access-1');
    reply = { status: 403, data: { error: { code: 'MEDICINE_FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' } } };

    const error = await failureOf(medicineApi.checkAccess());

    expect(isMedicineForbidden(error)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('reports a server error during the access check with the safe server message', async () => {
    localStorage.setItem('token', 'access-1');
    reply = { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống.' } } };

    const error = await failureOf(medicineApi.checkAccess());

    expect(isMedicineForbidden(error)).toBe(false);
    expect(describeMedicineError(error)).toBe('Đã xảy ra lỗi hệ thống.');
  });

  it.each([
    ['an empty body', undefined],
    ['a different value', { access: 'denied' }],
    ['an HTML page', '<html></html>'],
  ])('never treats %s as granted access', async (_label, data) => {
    localStorage.setItem('token', 'access-1');
    reply = { status: 200, data };

    const error = await failureOf(medicineApi.checkAccess());

    expect(describeMedicineError(error)).toBe('Phản hồi không hợp lệ từ Medicine backend.');
  });
});

describe('medicineApi.getStatus', () => {
  it('calls the configured Medicine destination and returns the status', async () => {
    reply = { status: 200, data: { status: 'ok', database: 'connected' } };

    await expect(medicineApi.getStatus()).resolves.toEqual({ status: 'ok', database: 'connected' });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.baseURL).toBe('http://localhost:3001/api/medicine');
    expect(requests[0]!.url).toBe('/status');
    expect(requests[0]!.method).toBe('get');
  });

  it('does not attach or require Auth credentials', async () => {
    localStorage.setItem('token', 'auth-access-token');
    localStorage.setItem('refreshToken', 'auth-refresh-token');
    reply = { status: 200, data: { status: 'ok', database: 'connected' } };

    await medicineApi.getStatus();

    expect(requests[0]!.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(requests[0]!.headers)).not.toContain('auth-');
    expect(requests[0]!.withCredentials).toBeFalsy();
  });

  it('reports the safe server message when Medicine is unavailable', async () => {
    reply = {
      status: 503,
      data: { error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu Medicine.' } },
    };

    const error = await failureOf(medicineApi.getStatus());

    expect(describeMedicineError(error)).toBe('Không kết nối được cơ sở dữ liệu Medicine.');
  });

  it('reports a network failure when Medicine cannot be reached', async () => {
    reply = 'network-error';

    const error = await failureOf(medicineApi.getStatus());

    expect(describeMedicineError(error)).toBe('Không liên lạc được với Medicine backend.');
  });

  it('reports the HTTP status when the error body is not a Medicine error', async () => {
    reply = { status: 502, data: '<html>Bad Gateway</html>' };

    const error = await failureOf(medicineApi.getStatus());

    expect(describeMedicineError(error)).toBe('Medicine backend trả lỗi (HTTP 502).');
  });

  it.each([
    ['an HTML page', '<!doctype html><html></html>'],
    ['a partial body', { status: 'ok' }],
    ['a disconnected body', { status: 'ok', database: 'disconnected' }],
  ])('never treats %s as a successful status', async (_label, data) => {
    reply = { status: 200, data };

    const error = await failureOf(medicineApi.getStatus());

    expect(describeMedicineError(error)).toBe('Phản hồi không hợp lệ từ Medicine backend.');
  });

  it('describes unknown errors generically', () => {
    expect(describeMedicineError(new Error('boom'))).toBe('Đã xảy ra lỗi không xác định.');
  });
});
