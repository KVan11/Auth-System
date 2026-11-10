import { useEffect, useState } from 'react';
import medicineApi, { describeMedicineError, isMedicineForbidden } from '../../api/medicineApi';
import MedicineLayout from '../../components/medicine/MedicineLayout';

type AccessState =
  | { kind: 'checking' }
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'failure'; message: string };

// Khu vực Medicine: chỉ hiện khi có quyền
const MedicineWorkspace = () => {
  const [access, setAccess] = useState<AccessState>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    medicineApi.checkAccess(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setAccess({ kind: 'granted' });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setAccess(isMedicineForbidden(error) ? { kind: 'denied' } : { kind: 'failure', message: describeMedicineError(error) });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setAccess({ kind: 'checking' });
    setAttempt((value) => value + 1);
  };

  return (
    <MedicineLayout>
      <h1 className="mb-4 text-3xl font-bold text-slate-900">Khu vực làm việc</h1>

      {access.kind === 'checking' && (
        <p role="status" className="rounded-2xl bg-slate-50 p-4 text-slate-600">
          Đang kiểm tra quyền truy cập…
        </p>
      )}

      {access.kind === 'denied' && (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-800">
          Tài khoản của bạn không có quyền vào khu vực Medicine.
        </p>
      )}

      {access.kind === 'failure' && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl bg-red-50 p-4 text-red-700">
          <span>{access.message}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      )}
    </MedicineLayout>
  );
};

export default MedicineWorkspace;
