import { subjectNotFound } from '../../errors.js';
import type { SearchRepository, SearchService, SubjectCandidate, SubjectRow } from './types.js';

// subjectRef: số nguyên dương, tối đa bằng giới hạn integer của PostgreSQL
const SUBJECT_REF = /^[1-9][0-9]{0,9}$/;
const MAX_INTEGER = 2147483647;

const parseSubjectRef = (subjectRef: string) => {
  if (!SUBJECT_REF.test(subjectRef)) return null;
  const id = Number(subjectRef);
  return id <= MAX_INTEGER ? id : null;
};

// Chỉ trả các trường đã duyệt
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
    // Sai dạng thì 404 luôn, không truy vấn
    const id = parseSubjectRef(subjectRef);
    if (id === null) throw subjectNotFound();

    const record = await repository.findSubject(id);
    if (!record) throw subjectNotFound();
    return { subjectRef: String(record.id), ptid: record.ptid };
  },
});
