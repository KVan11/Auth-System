import { useState } from 'react';
import exportApi from '../../api/exportApi';
import { describeMedicineError } from '../../api/medicineApi';

type State = { kind: 'idle' } | { kind: 'pending' } | { kind: 'failure'; message: string };

// Lưu file về máy qua một liên kết tạm, rồi giải phóng
const saveFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Nút xuất lịch hẹn (Excel) của bệnh nhân đang chọn
const VisitScheduleExportButton = ({ subjectRef }: { subjectRef: string }) => {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const download = async () => {
    setState({ kind: 'pending' });
    try {
      const { blob, fileName } = await exportApi.downloadVisitSchedule(subjectRef);
      saveFile(blob, fileName);
      setState({ kind: 'idle' });
    } catch (error) {
      setState({ kind: 'failure', message: describeMedicineError(error) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={download}
        disabled={state.kind === 'pending'}
        className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"
      >
        {state.kind === 'pending' ? 'Đang tạo file…' : 'Xuất lịch hẹn (Excel)'}
      </button>
      {state.kind === 'failure' && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
};

export default VisitScheduleExportButton;
