import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import medicineApi, { describeMedicineError, medicineClient } from '../../src/api/medicineApi';

type Reply = { status: number; data?: unknown } | 'network-error';

const requests: InternalAxiosRequestConfig[] = [];
let reply: Reply;

// Adapter giả thay cho HTTP thật
medicineClient.defaults.adapter = async (config) => {
  requests.push(config);
  if (reply === 'network-error') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  }
  const response: AxiosResponse = { status: reply.status, data: reply.data, statusText: '', headers: {}, config };
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, response);
  }
  return response;
};

const failureOf = (promise: Promise<unknown>) => promise.then(
  () => { throw new Error('expected failure'); },
  (error: unknown) => error
);

beforeEach(() => {
  requests.length = 0;
  localStorage.clear();
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
