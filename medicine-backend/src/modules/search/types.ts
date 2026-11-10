// Kiểu dữ liệu cho danh sách và tổng quan bệnh nhân

// Dòng trả về từ database
export interface SubjectRow {
  id: number;
  ptid: string | null;
  ten: string | null;
  // 'YYYY-MM-DD' hoặc null
  ngaySinh: string | null;
}

// Một bệnh nhân (cho trang tổng quan)
export interface SubjectRecord {
  id: number;
  ptid: string | null;
}

export interface SearchRepository {
  listSubjects(): Promise<SubjectRow[]>;
  findSubject(id: number): Promise<SubjectRecord | null>;
}

// DTO trả cho frontend
export interface SubjectCandidate {
  subjectRef: string;
  ptid: string | null;
  ten: string | null;
  ngaySinh: string | null;
}

export interface SubjectOverview {
  subjectRef: string;
  ptid: string | null;
}

export interface SearchService {
  listSubjects(): Promise<SubjectCandidate[]>;
  getSubject(subjectRef: string): Promise<SubjectOverview>;
}
