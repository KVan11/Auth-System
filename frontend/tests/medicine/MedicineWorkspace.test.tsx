import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import MedicineWorkspace from '../../src/pages/medicine/MedicineWorkspace';
import medicineApi from '../../src/api/medicineApi';
import authApi from '../../src/api/authApi';

vi.mock('../../src/api/medicineApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/medicineApi')>();
  return { ...actual, default: { getStatus: vi.fn(), checkAccess: vi.fn() } };
});

vi.mock('../../src/api/authApi', () => ({ default: { logout: vi.fn() } }));
const logout = vi.mocked(authApi.logout);

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

// Cần Router vì trang có <Link>
const renderWorkspace = () =>
  render(
    <MemoryRouter>
      <MedicineWorkspace />
    </MemoryRouter>
  );

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
  it('checks access first, then shows only the "Khu vực làm việc" heading', async () => {
    const access = deferred<void>();
    checkAccess.mockReturnValue(access.promise);

    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Khu vực làm việc' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra quyền truy cập');

    await act(async () => access.resolve());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/PTID/i)).not.toBeInTheDocument();
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('shows a denied message for a forbidden account', async () => {
    checkAccess.mockRejectedValue(httpError(403, 'Bạn không có quyền thực hiện thao tác này.'));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản của bạn không có quyền vào khu vực Medicine.');
    expect(screen.queryByRole('link', { name: 'Quay lại hồ sơ' })).not.toBeInTheDocument();
  });

  it('shows a server error during the access check distinctly and lets the user retry', async () => {
    checkAccess
      .mockRejectedValueOnce(httpError(500, 'Đã xảy ra lỗi hệ thống.'))
      .mockResolvedValueOnce(undefined);

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent('Đã xảy ra lỗi hệ thống.');
    expect(screen.queryByText(/không có quyền/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra quyền truy cập');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(checkAccess).toHaveBeenCalledTimes(2);
  });

  it('cancels the access check when the page is left', () => {
    checkAccess.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderWorkspace();
    unmount();

    expect(checkAccess.mock.calls[0]![0]?.aborted).toBe(true);
  });
});

describe('App routes', () => {
  it('opens the protected Medicine area at /medicine', async () => {
    checkAccess.mockResolvedValue(undefined);
    window.history.pushState({}, '', '/medicine');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Khu vực làm việc' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('links from the profile to the Medicine area through the header', async () => {
    checkAccess.mockReturnValue(new Promise(() => {}));
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'a@example.test', username: 'a', role: 'USER' }));
    window.history.pushState({}, '', '/profile');

    render(<App />);
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Medicine' }));

    expect(window.location.pathname).toBe('/medicine');
    expect(await screen.findByText('Đang kiểm tra quyền truy cập…')).toBeInTheDocument();
  });

  it('keeps the existing login route', () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng ký ngay' })).toHaveAttribute('href', '/register');
    expect(checkAccess).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
  });
});

describe('Account menu', () => {
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /Tài khoản/ }));

  beforeEach(() => {
    checkAccess.mockReturnValue(new Promise(() => {}));
    logout.mockReset();
  });

  it('shows "Hồ sơ" and "Đăng xuất" only after clicking "Tài khoản", and closes with Escape', () => {
    renderWorkspace();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    openMenu();
    expect(screen.getByRole('menuitem', { name: 'Hồ sơ' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('menuitem', { name: 'Đăng xuất' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the signed-in username instead of "Tài khoản"', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'admin@example.test', username: 'Admin', role: 'ADMIN' }));
    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Admin ▾' })).toBeInTheDocument();
  });

  it('falls back to the email, then to "Tài khoản"', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'admin@example.test', username: '' }));
    const { unmount } = renderWorkspace();
    expect(screen.getByRole('button', { name: 'admin@example.test ▾' })).toBeInTheDocument();
    unmount();

    localStorage.setItem('user', 'not json');
    renderWorkspace();
    expect(screen.getByRole('button', { name: 'Tài khoản ▾' })).toBeInTheDocument();
  });

  it('logs out through Auth, clears the session and returns to login', async () => {
    logout.mockResolvedValue({} as never);
    localStorage.setItem('token', 'access');
    localStorage.setItem('refreshToken', 'refresh');
    localStorage.setItem('user', '{}');
    window.history.pushState({}, '', '/medicine');
    render(<App />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(logout).toHaveBeenCalledWith('refresh');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('still logs out locally when Auth does not respond', async () => {
    logout.mockRejectedValue(new Error('network'));
    localStorage.setItem('refreshToken', 'refresh');
    window.history.pushState({}, '', '/medicine');
    render(<App />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
