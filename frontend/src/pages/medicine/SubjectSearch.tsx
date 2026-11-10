import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeMedicineError, isMedicineForbidden } from '../../api/medicineApi';
import searchApi from '../../api/searchApi';
import MedicineLayout from '../../components/medicine/MedicineLayout';
import type { SubjectCandidate } from '../../types/medicine';
import { applySubjectFilter, formatNgaySinh, parseSubjectFilter } from './subjectFilter';

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; items: SubjectCandidate[] }
  | { kind: 'denied' }
  | { kind: 'failure'; message: string };

const PTID_HINT =
  'PTID gồm 7 chữ số (chữ số đầu từ 1 đến 9) và 1 chữ cái in hoa, ví dụ 1234567A. Hãy nhập phần đầu của PTID.';

// Trang danh sách bệnh nhân
const SubjectSearch = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    searchApi.listSubjects(controller.signal).then(
      (items) => {
        if (!controller.signal.aborted) setList({ kind: 'loaded', items });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setList(isMedicineForbidden(error) ? { kind: 'denied' } : { kind: 'failure', message: describeMedicineError(error) });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setList({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  const filter = parseSubjectFilter(filterText);

  return (
    <MedicineLayout>
      <div className="mx-auto w-full lg:w-[70%]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Danh sách bệnh nhân</h1>
          </div>
          <button
            type="button"
            disabled
            title="Chức năng chưa được hỗ trợ"
            className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 font-semibold text-slate-500"
          >
            + Thêm bệnh nhân
          </button>
        </div>

        {list.kind === 'loading' && (
          <p role="status" className="rounded-2xl bg-slate-50 p-4 text-slate-600">
            Đang tải danh sách bệnh nhân…
          </p>
        )}

        {list.kind === 'denied' && (
          <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-800">
            Tài khoản của bạn không có quyền xem danh sách bệnh nhân.
          </p>
        )}

        {list.kind === 'failure' && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl bg-red-50 p-4 text-red-700">
            <span>{list.message}</span>
            <button
              type="button"
              onClick={retry}
              className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {list.kind === 'loaded' && list.items.length === 0 && (
          <p role="status" className="rounded-2xl bg-slate-50 p-4 text-slate-600">
            Chưa có bệnh nhân nào.
          </p>
        )}

        {list.kind === 'loaded' && list.items.length > 0 && (
          <SubjectTable
            items={list.items}
            filterText={filterText}
            onFilterChange={setFilterText}
            visible={applySubjectFilter(list.items, filter)}
            filter={filter}
            onSelect={(subjectRef) => navigate(`/medicine/subjects/${subjectRef}`)}
          />
        )}
      </div>
    </MedicineLayout>
  );
};

interface SubjectTableProps {
  items: SubjectCandidate[];
  visible: SubjectCandidate[];
  filterText: string;
  filter: ReturnType<typeof parseSubjectFilter>;
  onFilterChange: (value: string) => void;
  onSelect: (subjectRef: string) => void;
}

const SubjectTable = ({ items, visible, filterText, filter, onFilterChange, onSelect }: SubjectTableProps) => (
  <>
    <div className="mb-4">
      <label htmlFor="ptid-filter" className="mb-2 block text-sm font-semibold text-slate-700">
        Lọc theo PTID
      </label>
      <input
        id="ptid-filter"
        type="search"
        value={filterText}
        onChange={(event) => onFilterChange(event.target.value)}
        placeholder="Ví dụ: 1234567A"
        autoComplete="off"
        aria-describedby="ptid-filter-result"
        className="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
      />
      <p id="ptid-filter-result" role="status" className="mt-2 text-sm text-slate-500">
        {filter.kind === 'invalid' && <span className="text-amber-700">{PTID_HINT}</span>}
        {filter.kind === 'prefix' && visible.length === 0 && `Không có PTID nào bắt đầu bằng “${filter.prefix}”.`}
        {filter.kind !== 'invalid' && visible.length > 0 && `Hiển thị ${visible.length} / ${items.length} bệnh nhân.`}
      </p>
    </div>

    {visible.length > 0 && (
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-slate-800">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3">PTID</th>
              <th scope="col" className="px-5 py-3">Tên</th>
              <th scope="col" className="px-5 py-3">Ngày sinh</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">Xem</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item, index) => (
              // subjectRef có thể trùng (một PTID nhiều dòng)
              <tr key={`${item.subjectRef}-${index}`} className="transition hover:bg-blue-50/60">
                {/* Giữ nguyên khoảng trắng của PTID */}
                <td className="whitespace-pre px-5 py-3 font-mono font-semibold">{item.ptid ?? '—'}</td>
                <td className="px-5 py-3">{item.ten ?? '—'}</td>
                <td className="px-5 py-3 text-slate-600">{formatNgaySinh(item.ngaySinh)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(item.subjectRef)}
                    aria-label={`Xem ${item.ptid ?? 'bệnh nhân không có PTID'}`}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Xem
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>
);

export default SubjectSearch;
