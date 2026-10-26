import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import MedicineWorkspace from '../../src/pages/medicine/MedicineWorkspace';
import medicineApi from '../../src/api/medicineApi';

vi.mock('../../src/api/medicineApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/medicineApi')>();
  return { ...actual, default: { getStatus: vi.fn() } };
});

const getStatus = vi.mocked(medicineApi.getStatus);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const CONNECTED = { status: 'ok', database: 'connected' } as const;
const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);

beforeEach(() => {
  getStatus.mockReset();
  localStorage.clear();
});

describe('MedicineWorkspace', () => {
  it('shows pending, then success after the status call resolves', async () => {
    const call = deferred<typeof CONNECTED>();
    getStatus.mockReturnValue(call.promise);

    render(<MedicineWorkspace />);

    expect(screen.getByRole('heading', { name: 'Medicine' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra kết nối');

    await act(async () => call.resolve(CONNECTED));

    expect(screen.getByRole('status')).toHaveTextContent('Đã kết nối Medicine backend và cơ sở dữ liệu.');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('shows the failure message and lets the user retry', async () => {
    getStatus.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(CONNECTED);

    render(<MedicineWorkspace />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không liên lạc được với Medicine backend.');
    expect(screen.queryByText(/Đã kết nối/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra kết nối');
    expect(await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.')).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it('cancels the status call when the page is left', () => {
    getStatus.mockReturnValue(new Promise(() => {}));

    const { unmount } = render(<MedicineWorkspace />);
    unmount();

    const signal = getStatus.mock.calls[0]![0];
    expect(signal?.aborted).toBe(true);
  });

  it('works without any Auth session and shows no business data or inputs', async () => {
    getStatus.mockResolvedValue(CONNECTED);

    render(<MedicineWorkspace />);
    await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText(/PTID/i)).not.toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('opens the Medicine shell at /medicine', async () => {
    getStatus.mockResolvedValue(CONNECTED);
    window.history.pushState({}, '', '/medicine');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Medicine' })).toBeInTheDocument();
    await screen.findByText('Đã kết nối Medicine backend và cơ sở dữ liệu.');
  });

  it('keeps the existing login route', () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(getStatus).not.toHaveBeenCalled();
  });
});
