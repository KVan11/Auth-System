import { useNavigate } from 'react-router-dom';
import type { User } from '../types/auth';
import MedicineLayout from '../components/medicine/MedicineLayout';

const Profile = () => {
    const navigate = useNavigate();

    const userData = localStorage.getItem('user');
    let user: User | null = null;

    if (userData) {
        try {
            user = JSON.parse(userData) as User;
        } catch {
            user = null;
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 px-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-lg text-slate-700">
                        Bạn chưa đăng nhập.{' '}
                        <button
                            onClick={() => navigate('/login')}
                            className="font-bold text-blue-600 hover:underline"
                        >
                            Quay lại Login
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <MedicineLayout>
            <h1 className="mb-6 text-3xl font-bold text-slate-900">Hồ sơ của bạn</h1>

            <div className="grid gap-3 rounded-2xl bg-slate-50 p-5 text-slate-700">
                <p>
                    <span className="font-semibold text-slate-900">Tên đăng nhập:</span>{' '}
                    {user.username || 'Chưa có'}
                </p>
                <p>
                    <span className="font-semibold text-slate-900">Email:</span>{' '}
                    {user.email || 'Chưa có'}
                </p>
                {/* <p>
                    <span className="font-semibold text-slate-900">Vai trò:</span>{' '}
                    {user.role || 'Chưa có'}
                </p> */}
            </div>
        </MedicineLayout>
    );
}

export default Profile;