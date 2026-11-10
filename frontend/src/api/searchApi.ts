import type { SubjectCandidate, SubjectOverview } from '../types/medicine';
import { InvalidMedicineResponse, protectedGet } from './medicineApi';

// Gọi API danh sách và tổng quan bệnh nhân

const SUBJECT_REF = /^[1-9][0-9]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isStringOrNull = (value: unknown) => value === null || typeof value === 'string';

const isCandidate = (value: unknown): value is SubjectCandidate =>
  isObject(value) &&
  typeof value.subjectRef === 'string' &&
  SUBJECT_REF.test(value.subjectRef) &&
  isStringOrNull(value.ptid) &&
  isStringOrNull(value.ten) &&
  (value.ngaySinh === null || (typeof value.ngaySinh === 'string' && DATE.test(value.ngaySinh)));

// Chỉ giữ các trường đã duyệt
const toCandidate = ({ subjectRef, ptid, ten, ngaySinh }: SubjectCandidate): SubjectCandidate => ({
  subjectRef,
  ptid,
  ten,
  ngaySinh,
});

const searchApi = {
  listSubjects: async (signal?: AbortSignal): Promise<SubjectCandidate[]> => {
    const res = await protectedGet('/subjects', signal);
    const items = isObject(res.data) ? res.data.items : undefined;
    if (!Array.isArray(items) || !items.every(isCandidate)) throw new InvalidMedicineResponse();
    return items.map(toCandidate);
  },

  getSubject: async (subjectRef: string, signal?: AbortSignal): Promise<SubjectOverview> => {
    const res = await protectedGet(`/subjects/${encodeURIComponent(subjectRef)}`, signal);
    const data = res.data;
    // Phải đúng bệnh nhân đã yêu cầu
    if (!isObject(data) || data.subjectRef !== subjectRef || !isStringOrNull(data.ptid)) {
      throw new InvalidMedicineResponse();
    }
    return { subjectRef, ptid: data.ptid as string | null };
  },
};

export default searchApi;
