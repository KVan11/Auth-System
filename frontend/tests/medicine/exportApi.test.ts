import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToLogin, refreshAccessToken } from '../../src/api/axiosClient';
import exportApi from '../../src/api/exportApi';
import { describeMedicineError, isMedicineForbidden, medicineClient } from '../../src/api/medicineApi';

// Test client tải file Excel lịch hẹn 
vi.mock('../../src/api/axiosClient', () => ({
  default: {},
  refreshAccessToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));
const refresh = vi.mocked(refreshAccessToken);
vi.mocked(redirectToLogin);

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
type Reply = { status: number; data: unknown; headers?: Record<string, string> };

const requests: InternalAxiosRequestConfig[] = [];
let queued: Reply[] = [];

medicineClient.defaults.adapter = async (config) => {
  requests.push(config);
  const reply = queued.shift();
  if (!reply) throw new Error('no reply queued');
  const response: AxiosResponse = { status: reply.status, data: reply.data, statusText: '', headers: reply.headers ?? {}, config };
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
const file = () => new Blob(['xlsx-bytes'], { type: XLSX });
const jsonBlob = (body: unknown) => new Blob([JSON.stringify(body)], { type: 'application/json' });

beforeEach(() => {
  requests.length = 0;
  queued = [];
  localStorage.clear();
  refresh.mockReset();
});

describe('exportApi.downloadVisitSchedule', () => {
  it('requests the binary file with the Auth token and reads the file name', async () => {
    localStorage.setItem('token', 'access-1');
    queued = [
      {
        status: 200,
        data: file(),
        headers: { 'content-type': XLSX, 'content-disposition': 'attachment; filename="A5409_VS_01_VisitSchedule.xlsx"' },
      },
    ];

    const result = await exportApi.downloadVisitSchedule('20');

    expect(requests[0]!.url).toBe('/subjects/20/exports/visit-schedule');
    expect(requests[0]!.responseType).toBe('blob');
    expect(requests[0]!.headers.Authorization).toBe('Bearer access-1');
    expect(result.fileName).toBe('A5409_VS_01_VisitSchedule.xlsx');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('uses a default file name when the header is missing', async () => {
    queued = [{ status: 200, data: file(), headers: { 'content-type': XLSX } }];

    expect((await exportApi.downloadVisitSchedule('20')).fileName).toBe('A5409_VS_01_VisitSchedule.xlsx');
  });

  it('encodes the reference instead of building another path', async () => {
    queued = [{ status: 200, data: file(), headers: { 'content-type': XLSX } }];

    await exportApi.downloadVisitSchedule('../access');

    expect(requests[0]!.url).toBe('/subjects/..%2Faccess/exports/visit-schedule');
  });

  it('treats a non-Excel success response as an error, never as a file', async () => {
    queued = [{ status: 200, data: jsonBlob({ items: [] }), headers: { 'content-type': 'application/json' } }];

    const error = await failureOf(exportApi.downloadVisitSchedule('20'));

    expect(describeMedicineError(error)).toBe('Phản hồi không hợp lệ từ Medicine backend.');
  });

  it('shows the server message from a JSON error returned as a Blob', async () => {
    queued = [{ status: 500, data: jsonBlob({ error: { code: 'MEDICINE_EXPORT_FAILED', message: 'Không tạo được file Excel.' } }) }];

    const error = await failureOf(exportApi.downloadVisitSchedule('20'));

    expect(describeMedicineError(error)).toBe('Không tạo được file Excel.');
  });

  it('keeps 403 recognisable as forbidden', async () => {
    queued = [{ status: 403, data: jsonBlob({ error: { code: 'MEDICINE_FORBIDDEN', message: 'Không có quyền' } }) }];

    expect(isMedicineForbidden(await failureOf(exportApi.downloadVisitSchedule('20')))).toBe(true);
  });

  it('refreshes once through Auth on 401 and retries the download', async () => {
    localStorage.setItem('token', 'expired');
    refresh.mockResolvedValue('access-2');
    queued = [
      { status: 401, data: jsonBlob({ error: { code: 'MEDICINE_UNAUTHENTICATED', message: 'x' } }) },
      { status: 200, data: file(), headers: { 'content-type': XLSX } },
    ];

    await exportApi.downloadVisitSchedule('20');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests[1]!.headers.Authorization).toBe('Bearer access-2');
    expect(requests[1]!.responseType).toBe('blob');
  });
});
