import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import searchApi from '../../src/api/searchApi';
import SubjectOverview from '../../src/pages/medicine/SubjectOverview';
import type { SubjectOverview as Overview } from '../../src/types/medicine';

// Test trang tổng quan và bệnh nhân đang chọn
vi.mock('../../src/api/searchApi', () => ({ default: { listSubjects: vi.fn(), getSubject: vi.fn() } }));
const getSubject = vi.mocked(searchApi.getSubject);

const httpError = (status: number, code: string, message: string) => {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status, data: { error: { code, message } }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

// Liên kết để đổi bệnh nhân trong test
const renderOverview = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Link to="/medicine/subjects/21">sang 21</Link>
      <Link to="/medicine/subjects/20">sang 20</Link>
      <Routes>
        <Route path="/medicine/subjects/:subjectRef" element={<SubjectOverview />} />
        <Route path="/medicine/subjects" element={<p>Trang danh sách</p>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  getSubject.mockReset();
});

describe('SubjectOverview', () => {
  it('asks Medicine for the subject in the address and shows its PTID with the sections area', async () => {
    getSubject.mockResolvedValue({ subjectRef: '20', ptid: '1000001A' });

    renderOverview('/medicine/subjects/20');

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin bệnh nhân');
    expect(await screen.findByTestId('selected-ptid')).toHaveTextContent('1000001A');
    expect(getSubject).toHaveBeenCalledWith('20', expect.any(AbortSignal));
    expect(screen.getByRole('heading', { name: 'Phân hệ' })).toBeInTheDocument();
    // Chỉ hiện PTID
    expect(screen.queryByText(/Tên|Ngày sinh/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Danh sách bệnh nhân' })).toHaveAttribute('href', '/medicine/subjects');
  });

  it('shows the stored PTID unchanged and a dash when it is missing', async () => {
    getSubject.mockResolvedValue({ subjectRef: '26', ptid: null });

    renderOverview('/medicine/subjects/26');

    expect(await screen.findByTestId('selected-ptid')).toHaveTextContent('—');
  });

  it('reports "not found" for a missing, out-of-scope or malformed reference', async () => {
    getSubject.mockRejectedValue(httpError(404, 'MEDICINE_SUBJECT_NOT_FOUND', 'Không tìm thấy bệnh nhân.'));

    renderOverview('/medicine/subjects/abc');

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy bệnh nhân.');
    expect(screen.queryByTestId('selected-ptid')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Phân hệ' })).not.toBeInTheDocument();
  });

  it('explains denied access', async () => {
    getSubject.mockRejectedValue(httpError(403, 'MEDICINE_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));

    renderOverview('/medicine/subjects/20');

    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền xem bệnh nhân này');
  });

  it('shows a failure distinct from "not found" and retries', async () => {
    getSubject.mockRejectedValueOnce(httpError(503, 'MEDICINE_DB_UNAVAILABLE', 'Không kết nối được cơ sở dữ liệu Medicine.'));
    getSubject.mockResolvedValueOnce({ subjectRef: '20', ptid: '1000001A' });

    renderOverview('/medicine/subjects/20');

    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được cơ sở dữ liệu Medicine.');
    expect(screen.queryByText('Không tìm thấy bệnh nhân.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByTestId('selected-ptid')).toHaveTextContent('1000001A');
    expect(getSubject).toHaveBeenCalledTimes(2);
  });

  it('clears the previous subject at once, cancels its request and ignores its late answer', async () => {
    const first = deferred<Overview>();
    const second = deferred<Overview>();
    getSubject.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    renderOverview('/medicine/subjects/20');
    const firstSignal = getSubject.mock.calls[0]![1]!;

    fireEvent.click(screen.getByRole('link', { name: 'sang 21' }));

    expect(firstSignal.aborted).toBe(true);
    expect(getSubject).toHaveBeenLastCalledWith('21', expect.any(AbortSignal));

    // Phản hồi muộn của bệnh nhân cũ bị bỏ qua
    await act(async () => first.resolve({ subjectRef: '20', ptid: '1000001A' }));
    expect(screen.queryByTestId('selected-ptid')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin bệnh nhân');

    await act(async () => second.resolve({ subjectRef: '21', ptid: '1000002B' }));
    expect(screen.getByTestId('selected-ptid')).toHaveTextContent('1000002B');
  });

  it('hides the loaded subject as soon as another one is selected', async () => {
    getSubject.mockResolvedValueOnce({ subjectRef: '20', ptid: '1000001A' });
    getSubject.mockReturnValueOnce(new Promise(() => {}));

    renderOverview('/medicine/subjects/20');
    expect(await screen.findByTestId('selected-ptid')).toHaveTextContent('1000001A');

    fireEvent.click(screen.getByRole('link', { name: 'sang 21' }));

    expect(screen.queryByText('1000001A')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin bệnh nhân');
  });

  it('asks Medicine again when returning to a subject instead of reusing earlier data', async () => {
    getSubject.mockImplementation(async (subjectRef) => ({ subjectRef, ptid: subjectRef === '20' ? '1000001A' : '1000002B' }));

    renderOverview('/medicine/subjects/20');
    await screen.findByText('1000001A');
    fireEvent.click(screen.getByRole('link', { name: 'sang 21' }));
    await screen.findByText('1000002B');
    fireEvent.click(screen.getByRole('link', { name: 'sang 20' }));
    await screen.findByText('1000001A');

    expect(getSubject.mock.calls.map(([ref]) => ref)).toEqual(['20', '21', '20']);
  });
});
