// Phản hồi của GET /api/medicine/status
export interface MedicineStatus {
  status: 'ok';
  database: 'connected';
}

// Một bệnh nhân trong danh sách
export interface SubjectCandidate {
  // ID do server cấp
  subjectRef: string;
  // Giữ nguyên giá trị đã lưu
  ptid: string | null;
  ten: string | null;
  // 'YYYY-MM-DD' hoặc null
  ngaySinh: string | null;
}

// Tổng quan: chỉ PTID
export interface SubjectOverview {
  subjectRef: string;
  ptid: string | null;
}
