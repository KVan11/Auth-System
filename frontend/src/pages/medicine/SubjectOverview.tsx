import { Link, useParams } from 'react-router-dom';
import SubjectContext from '../../components/medicine/SubjectContext';
import MedicineLayout from '../../components/medicine/MedicineLayout';
import VisitScheduleExportButton from '../../components/medicine/VisitScheduleExportButton';

// Trang tổng quan: chỉ hiện PTID và các phân hệ
const SubjectOverview = () => {
  const { subjectRef = '' } = useParams();

  return (
    <MedicineLayout>
      <Link to="/medicine/subjects" className="text-sm font-semibold text-blue-600 hover:underline">
        ← Danh sách bệnh nhân
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-bold text-slate-900">Tổng quan bệnh nhân</h1>

      <SubjectContext subjectRef={subjectRef}>
        {(subject) => (
          <>
            <section aria-labelledby="sections-heading" className="mb-8">
              <h2 id="sections-heading" className="mb-2 text-lg font-semibold text-slate-800">
                Phân hệ
              </h2>
              {/* Các phân hệ sẽ thêm ở giai đoạn sau */}
              <p className="text-slate-600">Chưa có phân hệ nghiệp vụ nào được đưa vào sử dụng.</p>
            </section>

            <section aria-labelledby="forms-heading">
              <h2 id="forms-heading" className="mb-2 text-lg font-semibold text-slate-800">
                Biểu mẫu
              </h2>
              <VisitScheduleExportButton subjectRef={subject.subjectRef} />
            </section>
          </>
        )}
      </SubjectContext>
    </MedicineLayout>
  );
};

export default SubjectOverview;
