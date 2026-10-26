import { useEffect, useState } from 'react';
import medicineApi, { describeMedicineError } from '../../api/medicineApi';

type ConnectionState =
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'failure'; message: string };

// M1: khung trống của khu vực Medicine, chỉ hiển thị trạng thái kết nối (không có dữ liệu nghiệp vụ)
const MedicineWorkspace = () => {
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'pending' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    medicineApi.getStatus(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setConnection({ kind: 'success' });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setConnection({ kind: 'failure', message: describeMedicineError(error) });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setConnection({ kind: 'pending' });
    setAttempt((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-100 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Medicine</h1>
        <p className="mb-6 text-slate-600">
          Khu vực làm việc Medicine. Các chức năng nghiệp vụ sẽ được bổ sung ở các giai đoạn sau.
        </p>

        {connection.kind === 'failure' ? (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl bg-red-50 p-4 text-red-700">
            <span>{connection.message}</span>
            <button
              type="button"
              onClick={retry}
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <p
            role="status"
            className={
              connection.kind === 'success'
                ? 'rounded-2xl bg-green-50 p-4 text-green-700'
                : 'rounded-2xl bg-slate-50 p-4 text-slate-600'
            }
          >
            {connection.kind === 'success'
              ? 'Đã kết nối Medicine backend và cơ sở dữ liệu.'
              : 'Đang kiểm tra kết nối tới Medicine backend…'}
          </p>
        )}
      </div>
    </div>
  );
};

export default MedicineWorkspace;
