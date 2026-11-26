// Kiểu dữ liệu danh sách và tổng quan bệnh nhân.

// Repository: đúng các cột lấy từ database
export interface SubjectRow {
  id: number;
  ptid: string | null;
  ten: string | null;
  ngaySinh: string | null; // 'YYYY-MM-DD'
}

export interface SubjectRecord {
  id: number;
  ptid: string | null;
}

export interface SearchRepository {
  listSubjects(): Promise<SubjectRow[]>;
  findSubject(id: number): Promise<SubjectRecord | null>; // null = không tìm thấy
}

// Service: gửi cho frontend. subjectRef = ID database dạng chuỗi, dùng trong URL thay cho PTID.
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
  getSubject(subjectRef: string): Promise<SubjectOverview>; // không tìm thấy → ném lỗi 404
}
