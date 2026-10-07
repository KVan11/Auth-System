import { useNavigate } from 'react-router-dom';
import type { User } from '../types/auth';

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

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-100 px-6 py-10">
            <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
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

                <button
                    onClick={handleLogout}
                    className="mt-6 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700"
                >
                    Đăng xuất
                </button>
            </div>
        </div>
    );
}

export default Profile;