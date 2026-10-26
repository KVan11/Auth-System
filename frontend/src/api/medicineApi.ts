import axios, { isAxiosError } from 'axios';
import type { MedicineStatus } from '../types/medicine';
import { getAccessToken } from './authStorage';
import { redirectToLogin, refreshAccessToken } from './axiosClient';

// Client riêng cho Medicine backend
export const medicineClient = axios.create({
  baseURL: import.meta.env.VITE_MEDICINE_API_URL || 'http://localhost:3001/api/medicine',
  timeout: 10000,
});

class InvalidMedicineResponse extends Error {}

const isConnectedStatus = (data: unknown): data is MedicineStatus =>
  typeof data === 'object' &&
  data !== null &&
  (data as MedicineStatus).status === 'ok' &&
  (data as MedicineStatus).database === 'connected';

const isUnauthenticated = (error: unknown) => isAxiosError(error) && error.response?.status === 401;

// Request được bảo vệ: gắn access token của Auth; gặp 401 thì refresh qua Auth rồi thử lại đúng một lần.
// Không refresh được (hoặc vẫn 401) thì xoá phiên và về trang đăng nhập.
const protectedGet = async (url: string, signal?: AbortSignal) => {
  const send = (token: string | null) =>
    medicineClient.get<unknown>(url, {
      ...(signal ? { signal } : {}),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  try {
    return await send(getAccessToken());
  } catch (error) {
    if (!isUnauthenticated(error)) throw error;
    let token: string;
    try {
      token = await refreshAccessToken();
    } catch {
      redirectToLogin();
      throw error;
    }
    try {
      return await send(token);
    } catch (retryError) {
      if (isUnauthenticated(retryError)) redirectToLogin();
      throw retryError;
    }
  }
};

const medicineApi = {
  // Không cần đăng nhập: chỉ kiểm tra kết nối
  getStatus: async (signal?: AbortSignal) => {
    const res = await medicineClient.get<unknown>('/status', signal ? { signal } : {});
    // Chỉ coi là thành công khi đúng phản hồi mong đợi
    if (!isConnectedStatus(res.data)) throw new InvalidMedicineResponse();
    return res.data;
  },

  // Kiểm tra quyền vào khu vực Medicine (Medicine xác minh access token và áp dụng quyết định truy cập)
  checkAccess: async (signal?: AbortSignal) => {
    const res = await protectedGet('/access', signal);
    if ((res.data as { access?: unknown } | null)?.access !== 'granted') throw new InvalidMedicineResponse();
  },
};

export const isMedicineForbidden = (error: unknown) => isAxiosError(error) && error.response?.status === 403;

export const describeMedicineError = (error: unknown): string => {
  if (error instanceof InvalidMedicineResponse) return 'Phản hồi không hợp lệ từ Medicine backend.';
  if (isAxiosError<{ error?: { message?: unknown } }>(error)) {
    if (!error.response) return 'Không liên lạc được với Medicine backend.';
    const message = error.response.data?.error?.message;
    if (typeof message === 'string') return message;
    return `Medicine backend trả lỗi (HTTP ${error.response.status}).`;
  }
  return 'Đã xảy ra lỗi không xác định.';
};

export default medicineApi;
