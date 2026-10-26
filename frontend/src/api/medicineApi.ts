import axios, { isAxiosError } from 'axios';
import type { MedicineStatus } from '../types/medicine';

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

const medicineApi = {
  getStatus: async (signal?: AbortSignal) => {
    const res = await medicineClient.get<unknown>('/status', signal ? { signal } : {});
    // Chỉ coi là thành công khi đúng phản hồi mong đợi
    if (!isConnectedStatus(res.data)) throw new InvalidMedicineResponse();
    return res.data;
  },
};

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
