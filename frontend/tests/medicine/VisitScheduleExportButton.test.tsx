import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import exportApi from '../../src/api/exportApi';
import VisitScheduleExportButton from '../../src/components/medicine/VisitScheduleExportButton';

// Test nút xuất lịch hẹn: đang tạo, tải về, lỗi
vi.mock('../../src/api/exportApi', () => ({ default: { downloadVisitSchedule: vi.fn() } }));
const download = vi.mocked(exportApi.downloadVisitSchedule);

const httpError = (status: number, message: string) => {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status, data: { error: { code: 'X', message } }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clicked: { href: string; download: string }[];

beforeEach(() => {
  download.mockReset();
  createObjectURL = vi.fn(() => 'blob:visit-schedule');
  revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VisitScheduleExportButton', () => {
  it('downloads the generated workbook with its file name and releases the temporary URL', async () => {
    const blob = new Blob(['x']);
    download.mockResolvedValue({ blob, fileName: 'A5409_VS_01_VisitSchedule.xlsx' });
    render(<VisitScheduleExportButton subjectRef="20" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' })));

    expect(download).toHaveBeenCalledWith('20');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:visit-schedule', download: 'A5409_VS_01_VisitSchedule.xlsx' }]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:visit-schedule');
    expect(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a pending state and blocks double clicks while the file is generated', async () => {
    let finish!: (value: { blob: Blob; fileName: string }) => void;
    download.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<VisitScheduleExportButton subjectRef="20" />);

    fireEvent.click(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' }));

    const pending = screen.getByRole('button', { name: 'Đang tạo file…' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(download).toHaveBeenCalledTimes(1);

    await act(async () => finish({ blob: new Blob(['x']), fileName: 'f.xlsx' }));
    expect(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' })).toBeEnabled();
  });

  it.each([
    ['a generation failure', httpError(500, 'Không tạo được file Excel.'), 'Không tạo được file Excel.'],
    ['a denied export', httpError(403, 'Bạn không có quyền thực hiện thao tác này.'), 'Bạn không có quyền thực hiện thao tác này.'],
  ])('shows %s without saving any file and allows another try', async (_label, error, message) => {
    download.mockRejectedValueOnce(error);
    render(<VisitScheduleExportButton subjectRef="20" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' })));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(clicked).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Xuất lịch hẹn (Excel)' })).toBeEnabled();
  });
});
