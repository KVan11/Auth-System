import { Link, useParams } from 'react-router-dom';
import SubjectContext from '../../components/medicine/SubjectContext';
import MedicineLayout from '../../components/medicine/MedicineLayout';

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
        {() => (
          <section aria-labelledby="sections-heading">
            <h2 id="sections-heading" className="mb-2 text-lg font-semibold text-slate-800">
              Phân hệ
            </h2>
            {/* Các phân hệ sẽ thêm ở giai đoạn sau */}
            <p className="text-slate-600">Chưa có phân hệ nghiệp vụ nào được đưa vào sử dụng.</p>
          </section>
        )}
      </SubjectContext>
    </MedicineLayout>
  );
};

export default SubjectOverview;
