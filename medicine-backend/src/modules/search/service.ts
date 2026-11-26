// Kiểm tra subjectRef và chỉ chọn trường được phép gửi cho frontend.

import { subjectNotFound } from '../../errors.js';
import type { SearchRepository, SearchService, SubjectCandidate, SubjectRow } from './types.js';

const SUBJECT_REF = /^[1-9][0-9]{0,9}$/;
const MAX_INTEGER = 2147483647; // giới hạn kiểu integer của PostgreSQL

// '20' → 20; sai dạng hoặc quá lớn → null
const parseSubjectRef = (subjectRef: string): number | null => {
  if (!SUBJECT_REF.test(subjectRef)) return null;
  const id = Number(subjectRef);
  if (id > MAX_INTEGER) return null;
  return id;
};

// Liệt kê từng trường để cột mới trong SQL không tự lộ ra
const toCandidate = (row: SubjectRow): SubjectCandidate => ({
  subjectRef: String(row.id),
  ptid: row.ptid,
  ten: row.ten,
  ngaySinh: row.ngaySinh,
});

export const createSearchService = (repository: SearchRepository): SearchService => ({
  async listSubjects() {
    const rows = await repository.listSubjects();
    return rows.map(toCandidate);
  },

  async getSubject(subjectRef) {
    const id = parseSubjectRef(subjectRef);
    if (id === null) throw subjectNotFound();

    const record = await repository.findSubject(id);
    if (!record) throw subjectNotFound();
    return { subjectRef: String(record.id), ptid: record.ptid };
  },
});
