import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import medicineApi, { describeMedicineError, isMedicineForbidden } from '../../api/medicineApi';

type AccessState =
  | { kind: 'checking' }
  | { kind: 'granted' }
  | { kind: 'denied' }
  | { kind: 'failure'; message: string };

type ConnectionState =
  | { kind: 'pending' }
  | { kind: 'success' }
  | { kind: 'failure'; message: string };

// Trạng thái kết nối tới Medicine backend và database (từ M1, không có dữ liệu nghiệp vụ)
const ConnectionStatus = () => {
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

  if (connection.kind === 'failure') {
    return (
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
    );
  }

  return (
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
  );
};

// Khu vực Medicine: chỉ hiển thị sau khi Medicine xác nhận quyền vào (chưa đăng nhập thì về /login)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-100 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Medicine</h1>

        {access.kind === 'checking' && (
          <p role="status" className="rounded-2xl bg-slate-50 p-4 text-slate-600">
            Đang kiểm tra quyền truy cập…
          </p>
        )}

        {access.kind === 'denied' && (
          <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-800">
            <p>Tài khoản của bạn không có quyền vào khu vực Medicine.</p>
            <Link to="/profile" className="mt-2 inline-block font-semibold text-blue-600 hover:underline">
              Quay lại hồ sơ
            </Link>
          </div>
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

        {access.kind === 'granted' && (
          <>
            <p className="mb-6 text-slate-600">
              Khu vực làm việc Medicine. Các chức năng nghiệp vụ sẽ được bổ sung ở các giai đoạn sau.
            </p>
            <ConnectionStatus />
          </>
        )}
      </div>
    </div>
  );
};

export default MedicineWorkspace;
