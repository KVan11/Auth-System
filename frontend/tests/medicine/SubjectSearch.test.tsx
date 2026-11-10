import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import searchApi from '../../src/api/searchApi';
import SubjectSearch from '../../src/pages/medicine/SubjectSearch';
import type { SubjectCandidate } from '../../src/types/medicine';

// Test trang danh sách bệnh nhân
vi.mock('../../src/api/searchApi', () => ({ default: { listSubjects: vi.fn(), getSubject: vi.fn() } }));
const listSubjects = vi.mocked(searchApi.listSubjects);

const httpError = (status: number, message: string) => {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status, data: { error: { code: 'X', message } }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const ITEMS: SubjectCandidate[] = [
  { subjectRef: '25', ptid: ' 1000008h ', ten: null, ngaySinh: null },
  { subjectRef: '20', ptid: '1000001A', ten: 'Nguyễn Văn A', ngaySinh: '1990-05-12' },
  { subjectRef: '21', ptid: '1000002B', ten: null, ngaySinh: null },
  { subjectRef: '29', ptid: '1000011K', ten: 'Lê Văn K (1)', ngaySinh: '2001-01-31' },
  { subjectRef: '29', ptid: '1000011K', ten: 'Lê Văn K (2)', ngaySinh: null },
  { subjectRef: '22', ptid: '12345678', ten: null, ngaySinh: null },
  { subjectRef: '26', ptid: null, ten: null, ngaySinh: null },
];

const OverviewProbe = () => <p>Tổng quan của {useParams().subjectRef}</p>;

const renderSearch = () =>
  render(
    <MemoryRouter initialEntries={['/medicine/subjects']}>
      <Routes>
        <Route path="/medicine/subjects" element={<SubjectSearch />} />
        <Route path="/medicine/subjects/:subjectRef" element={<OverviewProbe />} />
      </Routes>
    </MemoryRouter>
  );

const rows = () => screen.queryAllByRole('row').slice(1);
const ptidsShown = () => rows().map((row) => within(row).getAllByRole('cell')[0]!.textContent);
const typeFilter = (value: string) => fireEvent.change(screen.getByLabelText('Lọc theo PTID'), { target: { value } });

beforeEach(() => {
  listSubjects.mockReset();
});

describe('SubjectSearch loading and outcomes', () => {
  it('shows loading, then every candidate with PTID, name and birth date', async () => {
    const pending = deferred<SubjectCandidate[]>();
    listSubjects.mockReturnValue(pending.promise);

    renderSearch();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách bệnh nhân');

    await act(async () => pending.resolve(ITEMS));

    expect(listSubjects).toHaveBeenCalledTimes(1);
    expect(ptidsShown()).toEqual([' 1000008h ', '1000001A', '1000002B', '1000011K', '1000011K', '12345678', '—']);
    const first = within(rows()[1]!).getAllByRole('cell');
    expect(first[1]).toHaveTextContent('Nguyễn Văn A');
    expect(first[2]).toHaveTextContent('12/05/1990');
    const unnamed = within(rows()[2]!).getAllByRole('cell');
    expect(unnamed[1]).toHaveTextContent('—');
    expect(unnamed[2]).toHaveTextContent('—');
    expect(screen.getByText('Hiển thị 7 / 7 bệnh nhân.')).toBeInTheDocument();
  });

  it('shows an empty list as its own successful state without offering to create a subject', async () => {
    listSubjects.mockResolvedValue([]);

    renderSearch();

    expect(await screen.findByText('Chưa có bệnh nhân nào.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Không có dòng nào để xem; nút thêm bệnh nhân bị vô hiệu hoá
    expect(screen.queryByRole('button', { name: /^Xem/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Thêm bệnh nhân' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a failure (not an empty list) and retries on request', async () => {
    listSubjects.mockRejectedValueOnce(httpError(503, 'Không kết nối được cơ sở dữ liệu Medicine.'));
    listSubjects.mockResolvedValueOnce(ITEMS);

    renderSearch();

    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được cơ sở dữ liệu Medicine.');
    expect(screen.queryByText('Chưa có bệnh nhân nào.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Hiển thị 7 / 7 bệnh nhân.')).toBeInTheDocument();
    expect(listSubjects).toHaveBeenCalledTimes(2);
  });

  it('explains a denied list separately from other failures', async () => {
    listSubjects.mockRejectedValue(httpError(403, 'Bạn không có quyền thực hiện thao tác này.'));

    renderSearch();

    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền xem danh sách bệnh nhân');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('cancels the request when leaving the page', async () => {
    listSubjects.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderSearch();
    const signal = listSubjects.mock.calls[0]![0]!;
    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe('SubjectSearch PTID prefix filter', () => {
  beforeEach(() => {
    listSubjects.mockResolvedValue(ITEMS);
  });

  it('filters by the normalized prefix: spaces removed, upper-cased, compared exactly with stored values', async () => {
    renderSearch();
    await screen.findByRole('table');

    typeFilter(' 1000 00 ');
    expect(ptidsShown()).toEqual(['1000001A', '1000002B']);

    typeFilter('1000001a');
    expect(ptidsShown()).toEqual(['1000001A']);

    // PTID sai dạng vẫn lọc được
    typeFilter('1234');
    expect(ptidsShown()).toEqual(['12345678']);

    // Không trim PTID đã lưu
    typeFilter('1000008');
    expect(rows()).toHaveLength(0);
    expect(screen.getByText('Không có PTID nào bắt đầu bằng “1000008”.')).toBeInTheDocument();
  });

  it('keeps duplicated combinations as separate rows', async () => {
    renderSearch();
    await screen.findByRole('table');

    typeFilter('1000011');

    expect(rows().map((row) => within(row).getAllByRole('cell')[1]!.textContent)).toEqual([
      'Lê Văn K (1)',
      'Lê Văn K (2)',
    ]);
  });

  it('shows every row, including a missing PTID, when the filter is empty again', async () => {
    renderSearch();
    await screen.findByRole('table');

    typeFilter('1');
    expect(ptidsShown()).not.toContain('—');

    typeFilter('   ');
    expect(rows()).toHaveLength(7);
    expect(ptidsShown()).toContain('—');
  });

  it.each(['0123', 'A', '-1', '1-2', '1A', '123456A7', '1234567AB', '123456789', '１２３'])(
    'explains the PTID format and shows no row for invalid input %j',
    async (value) => {
      renderSearch();
      await screen.findByRole('table');

      typeFilter(value);

      expect(rows()).toHaveLength(0);
      expect(screen.getByText(/PTID gồm 7 chữ số/)).toBeInTheDocument();
    }
  );

  it('accepts a full 8-character PTID and keeps only the exact match', async () => {
    renderSearch();
    await screen.findByRole('table');

    typeFilter('1000002b');

    expect(ptidsShown()).toEqual(['1000002B']);
  });
});

describe('SubjectSearch selection', () => {
  it('shows the add-subject button as disabled; clicking it does nothing', async () => {
    listSubjects.mockResolvedValue(ITEMS);
    renderSearch();
    await screen.findByRole('table');

    const add = screen.getByRole('button', { name: '+ Thêm bệnh nhân' });
    expect(add).toBeDisabled();
    fireEvent.click(add);

    expect(screen.queryByText(/Tổng quan của/)).not.toBeInTheDocument();
    expect(listSubjects).toHaveBeenCalledTimes(1);
  });

  it('does not open a single remaining candidate automatically; the user must press "Xem"', async () => {
    listSubjects.mockResolvedValue(ITEMS);
    renderSearch();
    await screen.findByRole('table');

    typeFilter('1000001A');
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText(/Tổng quan của/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem 1000001A' }));

    expect(screen.getByText('Tổng quan của 20')).toBeInTheDocument();
  });

  it('opens the overview of the chosen row among several, using its server reference', async () => {
    listSubjects.mockResolvedValue(ITEMS);
    renderSearch();
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Xem 12345678' }));

    expect(screen.getByText('Tổng quan của 22')).toBeInTheDocument();
  });

  it('lets a candidate without PTID be chosen', async () => {
    listSubjects.mockResolvedValue(ITEMS);
    renderSearch();
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Xem bệnh nhân không có PTID' }));

    expect(screen.getByText('Tổng quan của 26')).toBeInTheDocument();
  });
});
