import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import MedicineWorkspace from '../../src/pages/medicine/MedicineWorkspace';
import medicineApi from '../../src/api/medicineApi';

vi.mock('../../src/api/medicineApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/medicineApi')>();
  return { ...actual, default: { getStatus: vi.fn(), checkAccess: vi.fn() } };
});

const getStatus = vi.mocked(medicineApi.getStatus);
const checkAccess = vi.mocked(medicineApi.checkAccess);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Trong app, trang luôn nằm trong BrowserRouter (có <Link>)
const renderWorkspace = () =>
  render(
    <MemoryRouter>
      <MedicineWorkspace />
    </MemoryRouter>
  );

const CONNECTED = { status: 'ok', database: 'connected' } as const;
const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);
const httpError = (status: number, message: string) => {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = { status, data: { error: { code: 'X', message } }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

beforeEach(() => {
  getStatus.mockReset();
  checkAccess.mockReset();
  localStorage.clear();
});

describe('MedicineWorkspace access', () => {
  it('checks access first, then shows the workspace and connection status', async () => {
    const access = deferred<void>();
    checkAccess.mockReturnValue(access.promise);
    getStatus.mockResolvedValue(CONNECTED);

    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Medicine' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra quyền truy cập');
    expect(getStatus).not.toHaveBeenCalled();

    await act(async () => access.resolve());

    expect(await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.')).toBeInTheDocument();
    expect(screen.getByText(/Khu vực làm việc Medicine/)).toBeInTheDocument();
  });

  it('shows a denied message for a forbidden account and never loads the workspace', async () => {
    checkAccess.mockRejectedValue(httpError(403, 'Bạn không có quyền thực hiện thao tác này.'));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản của bạn không có quyền vào khu vực Medicine.');
    expect(screen.getByRole('link', { name: 'Quay lại hồ sơ' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByText(/Khu vực làm việc Medicine/)).not.toBeInTheDocument();
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('shows a server error during the access check distinctly and lets the user retry', async () => {
    checkAccess
      .mockRejectedValueOnce(httpError(500, 'Đã xảy ra lỗi hệ thống.'))
      .mockResolvedValueOnce(undefined);
    getStatus.mockResolvedValue(CONNECTED);

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent('Đã xảy ra lỗi hệ thống.');
    expect(screen.queryByText(/không có quyền/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra quyền truy cập');
    expect(await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.')).toBeInTheDocument();
    expect(checkAccess).toHaveBeenCalledTimes(2);
  });

  it('cancels the access check when the page is left', () => {
    checkAccess.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderWorkspace();
    unmount();

    expect(checkAccess.mock.calls[0]![0]?.aborted).toBe(true);
  });
});

describe('MedicineWorkspace connection status (after access is granted)', () => {
  beforeEach(() => {
    checkAccess.mockResolvedValue(undefined);
  });

  it('shows pending, then success after the status call resolves', async () => {
    const call = deferred<typeof CONNECTED>();
    getStatus.mockReturnValue(call.promise);

    renderWorkspace();

    expect(await screen.findByText('Đang kiểm tra kết nối tới Medicine backend…')).toBeInTheDocument();

    await act(async () => call.resolve(CONNECTED));

    expect(screen.getByRole('status')).toHaveTextContent('Đã kết nối Medicine backend và cơ sở dữ liệu.');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('shows the failure message and lets the user retry', async () => {
    getStatus.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(CONNECTED);

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent('Không liên lạc được với Medicine backend.');
    expect(screen.queryByText(/Đã kết nối/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra kết nối');
    expect(await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.')).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(checkAccess).toHaveBeenCalledTimes(1);
  });

  it('cancels the status call when the page is left', async () => {
    getStatus.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderWorkspace();
    await screen.findByText('Đang kiểm tra kết nối tới Medicine backend…');
    unmount();

    expect(getStatus.mock.calls[0]![0]?.aborted).toBe(true);
  });

  it('shows no business data or inputs', async () => {
    getStatus.mockResolvedValue(CONNECTED);

    renderWorkspace();
    await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText(/PTID/i)).not.toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('opens the protected Medicine area at /medicine', async () => {
    checkAccess.mockResolvedValue(undefined);
    getStatus.mockResolvedValue(CONNECTED);
    window.history.pushState({}, '', '/medicine');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Medicine' })).toBeInTheDocument();
    await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.');
  });

  it('links from the profile to the Medicine area', async () => {
    checkAccess.mockReturnValue(new Promise(() => {}));
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'a@example.test', username: 'a', role: 'USER' }));
    window.history.pushState({}, '', '/profile');

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Vào khu vực Medicine' }));

    expect(window.location.pathname).toBe('/medicine');
    expect(await screen.findByText('Đang kiểm tra quyền truy cập…')).toBeInTheDocument();
  });

  it('keeps the existing login route', () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(checkAccess).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
  });
});
