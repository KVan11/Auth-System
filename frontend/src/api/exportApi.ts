import { isAxiosError } from 'axios';
import { InvalidMedicineResponse, protectedGet } from './medicineApi';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_NAME = 'A5409_VS_01_VisitSchedule.xlsx';

// Lỗi trả về dạng Blob: đọc lại thành JSON để hiện đúng thông báo của server
const decodeBlobError = async (error: unknown) => {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch {
      error.response.data = undefined;
    }
  }
  return error;
};

const fileNameOf = (header: unknown) => {
  const match = typeof header === 'string' ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] ?? DEFAULT_NAME;
};

const exportApi = {
  // Tải file Excel lịch hẹn của bệnh nhân
  downloadVisitSchedule: async (subjectRef: string, signal?: AbortSignal) => {
    let res;
    try {
      res = await protectedGet(`/subjects/${encodeURIComponent(subjectRef)}/exports/visit-schedule`, signal, 'blob');
    } catch (error) {
      throw await decodeBlobError(error);
    }
    const blob = res.data;
    if (!(blob instanceof Blob) || !String(res.headers['content-type']).startsWith(XLSX)) throw new InvalidMedicineResponse();
    return { blob, fileName: fileNameOf(res.headers['content-disposition']) };
  },
};

export default exportApi;
