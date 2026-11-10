import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { describeMedicineError, isMedicineForbidden, isMedicineNotFound } from '../../api/medicineApi';
import searchApi from '../../api/searchApi';
import type { SubjectOverview } from '../../types/medicine';

type Result =
  | { kind: 'loaded'; subject: SubjectOverview }
  | { kind: 'notFound' }
  | { kind: 'denied' }
  | { kind: 'failure'; message: string };

interface SubjectContextProps {
  // Lấy từ địa chỉ trang
  subjectRef: string;
  children: (subject: SubjectOverview) => ReactNode;
}

// Tải bệnh nhân đang chọn từ server; đổi bệnh nhân thì bỏ dữ liệu cũ ngay
const SubjectContext = ({ subjectRef, children }: SubjectContextProps) => {
  // Kết quả của subjectRef khác thì coi như đang tải
  const [result, setResult] = useState<{ subjectRef: string; attempt: number; value: Result } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const settle = (value: Result) => {
      if (!controller.signal.aborted) setResult({ subjectRef, attempt, value });
    };
    searchApi.getSubject(subjectRef, controller.signal).then(
      (subject) => settle({ kind: 'loaded', subject }),
      (error: unknown) => {
        if (isMedicineNotFound(error)) settle({ kind: 'notFound' });
        else if (isMedicineForbidden(error)) settle({ kind: 'denied' });
        else settle({ kind: 'failure', message: describeMedicineError(error) });
      }
    );
    return () => controller.abort();
  }, [subjectRef, attempt]);

  const current = result && result.subjectRef === subjectRef && result.attempt === attempt ? result.value : null;

  if (current === null) {
    return (
      <p role="status" className="rounded-2xl bg-slate-50 p-4 text-slate-600">
        Đang tải thông tin bệnh nhân…
      </p>
    );
  }

  if (current.kind === 'notFound') {
    return (
      <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-800">
        <p>Không tìm thấy bệnh nhân.</p>
        <Link to="/medicine/subjects" className="mt-2 inline-block font-semibold text-blue-600 hover:underline">
          Chọn bệnh nhân khác
        </Link>
      </div>
    );
  }

  if (current.kind === 'denied') {
    return (
      <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-800">
        Tài khoản của bạn không có quyền xem bệnh nhân này.
      </p>
    );
  }

  if (current.kind === 'failure') {
    return (
      <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl bg-red-50 p-4 text-red-700">
        <span>{current.message}</span>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <>
      {/* PTID luôn hiển thị */}
      <p className="mb-6 rounded-2xl bg-blue-50 p-4 text-blue-900">
        Bệnh nhân đang chọn — PTID:{' '}
        <strong data-testid="selected-ptid" className="whitespace-pre font-mono">
          {current.subject.ptid ?? '—'}
        </strong>
      </p>
      {children(current.subject)}
    </>
  );
};

export default SubjectContext;
