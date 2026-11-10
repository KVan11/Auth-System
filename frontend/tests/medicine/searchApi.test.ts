import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToLogin, refreshAccessToken } from '../../src/api/axiosClient';
import {
  describeMedicineError,
  isMedicineForbidden,
  isMedicineNotFound,
  medicineClient,
} from '../../src/api/medicineApi';
import searchApi from '../../src/api/searchApi';

// Test client danh sách và tổng quan bệnh nhân
vi.mock('../../src/api/axiosClient', () => ({
  default: {},
  refreshAccessToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));
const refresh = vi.mocked(refreshAccessToken);
const redirect = vi.mocked(redirectToLogin);

type Reply = { status: number; data?: unknown } | 'network-error';

const requests: InternalAxiosRequestConfig[] = [];
let queued: Reply[] = [];

medicineClient.defaults.adapter = async (config) => {
  requests.push(config);
  const reply = queued.shift();
  if (!reply) throw new Error('no reply queued');
  if (reply === 'network-error') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
  const response: AxiosResponse = { status: reply.status, data: reply.data, statusText: '', headers: {}, config };
  if (reply.status >= 400) throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, response);
  return response;
};

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure');
    },
    (error: unknown) => error
  );

const CANDIDATES = [
  { subjectRef: '20', ptid: '1000001A', ten: 'Nguyễn Văn A', ngaySinh: '1990-05-12' },
  { subjectRef: '25', ptid: ' 1000008h ', ten: null, ngaySinh: null },
  { subjectRef: '26', ptid: null, ten: null, ngaySinh: null },
];

beforeEach(() => {
  requests.length = 0;
  queued = [];
  localStorage.clear();
  refresh.mockReset();
  redirect.mockReset();
});

describe('searchApi.listSubjects', () => {
  it('requests the full list with the Auth access token and no search criteria', async () => {
    localStorage.setItem('token', 'access-1');
    queued = [{ status: 200, data: { items: CANDIDATES } }];

    await expect(searchApi.listSubjects()).resolves.toEqual(CANDIDATES);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('get');
    expect(requests[0]!.url).toBe('/subjects');
    expect(requests[0]!.params).toBeUndefined();
    expect(requests[0]!.data).toBeUndefined();
    expect(requests[0]!.headers.Authorization).toBe('Bearer access-1');
  });

  it('keeps stored values unchanged and drops unapproved fields', async () => {
    queued = [{ status: 200, data: { items: [{ ...CANDIDATES[1], DienThoai: '0900000000' }] } }];

    const [item] = await searchApi.listSubjects();

    expect(item).toEqual(CANDIDATES[1]);
    expect(Object.keys(item!).sort()).toEqual(['ngaySinh', 'ptid', 'subjectRef', 'ten']);
  });

  it('returns an empty list as success', async () => {
    queued = [{ status: 200, data: { items: [] } }];

    await expect(searchApi.listSubjects()).resolves.toEqual([]);
  });

  it.each([
    ['no body', undefined],
    ['items missing', {}],
    ['items not an array', { items: 'x' }],
    ['a numeric subjectRef', { items: [{ ...CANDIDATES[0], subjectRef: 20 }] }],
    ['a malformed subjectRef', { items: [{ ...CANDIDATES[0], subjectRef: '020' }] }],
    ['a numeric PTID', { items: [{ ...CANDIDATES[0], ptid: 1000001 }] }],
    ['a missing name field', { items: [{ subjectRef: '20', ptid: 'x', ngaySinh: null }] }],
    ['a full timestamp birth date', { items: [{ ...CANDIDATES[0], ngaySinh: '1990-05-12T00:00:00.000Z' }] }],
  ])('treats a response with %s as an error, never as an empty list', async (_label, data) => {
    queued = [{ status: 200, data }];

    const error = await failureOf(searchApi.listSubjects());

    expect(describeMedicineError(error)).toBe('Phản hồi không hợp lệ từ Medicine backend.');
  });

  it('refreshes once through Auth on 401 and retries with the new token', async () => {
    localStorage.setItem('token', 'expired');
    refresh.mockResolvedValue('access-2');
    queued = [{ status: 401, data: { error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'x' } } }, { status: 200, data: { items: [] } }];

    await expect(searchApi.listSubjects()).resolves.toEqual([]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests[1]!.headers.Authorization).toBe('Bearer access-2');
  });

  it('exposes 403 as forbidden and keeps the server message for other failures', async () => {
    queued = [{ status: 403, data: { error: { code: 'MEDICINE_FORBIDDEN', message: 'Không có quyền' } } }];
    expect(isMedicineForbidden(await failureOf(searchApi.listSubjects()))).toBe(true);

    queued = [{ status: 503, data: { error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'DB lỗi' } } }];
    const error = await failureOf(searchApi.listSubjects());
    expect(isMedicineForbidden(error)).toBe(false);
    expect(describeMedicineError(error)).toBe('DB lỗi');

    queued = ['network-error'];
    expect(describeMedicineError(await failureOf(searchApi.listSubjects()))).toBe('Không liên lạc được với Medicine backend.');
  });
});

describe('searchApi.getSubject', () => {
  it('requests the overview of exactly the selected reference', async () => {
    localStorage.setItem('token', 'access-1');
    queued = [{ status: 200, data: { subjectRef: '20', ptid: '1000001A' } }];

    await expect(searchApi.getSubject('20')).resolves.toEqual({ subjectRef: '20', ptid: '1000001A' });

    expect(requests[0]!.url).toBe('/subjects/20');
    expect(requests[0]!.headers.Authorization).toBe('Bearer access-1');
  });

  it('encodes a reference taken from the address bar instead of building another path', async () => {
    queued = [{ status: 404, data: { error: { code: 'MEDICINE_SUBJECT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân.' } } }];

    const error = await failureOf(searchApi.getSubject('../access'));

    expect(requests[0]!.url).toBe('/subjects/..%2Faccess');
    expect(isMedicineNotFound(error)).toBe(true);
  });

  it.each([
    ['another subject', { subjectRef: '21', ptid: '1000002B' }],
    ['no subjectRef', { ptid: '1000001A' }],
    ['a numeric PTID', { subjectRef: '20', ptid: 1000001 }],
    ['no body', undefined],
  ])('rejects a response for %s', async (_label, data) => {
    queued = [{ status: 200, data }];

    const error = await failureOf(searchApi.getSubject('20'));

    expect(describeMedicineError(error)).toBe('Phản hồi không hợp lệ từ Medicine backend.');
  });

  it('distinguishes "not found" from other 404s and failures', async () => {
    queued = [{ status: 404, data: { error: { code: 'NOT_FOUND', message: 'Không tìm thấy API.' } } }];
    expect(isMedicineNotFound(await failureOf(searchApi.getSubject('20')))).toBe(false);

    queued = [{ status: 503, data: { error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'DB lỗi' } } }];
    expect(isMedicineNotFound(await failureOf(searchApi.getSubject('20')))).toBe(false);
  });
});
