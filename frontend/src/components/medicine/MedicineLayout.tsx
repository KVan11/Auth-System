import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authApi from '../../api/authApi';
import { clearAuthSession, getRefreshToken } from '../../api/authStorage';

// Tên hiển thị của người đang đăng nhập (chỉ để hiển thị, không dùng để phân quyền)
const displayName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? 'null') as { username?: unknown; email?: unknown } | null;
    if (typeof user?.username === 'string' && user.username) return user.username;
    if (typeof user?.email === 'string' && user.email) return user.email;
  } catch {
    // Dữ liệu hỏng: dùng tên mặc định
  }
  return 'Tài khoản';
};

// Menu tài khoản: Hồ sơ, Đăng xuất
const AccountMenu = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Vẫn đăng xuất phía client kể cả khi server không phản hồi
    } finally {
      clearAuthSession();
      navigate('/login');
    }
  };

  const itemClass = 'block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100';

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-slate-600 hover:text-blue-600"
      >
        {displayName()} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            Hồ sơ
          </Link>
          <button type="button" role="menuitem" onClick={logout} className={`${itemClass} text-red-600`}>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
};

// Khung chung toàn trang cho các trang Medicine
const MedicineLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-white">
    <header className="border-b border-slate-200 bg-white">
      {/* 3 cột: tên ứng dụng | menu ở giữa | người dùng */}
      <div className="grid grid-cols-3 items-center gap-4 px-8 py-4 text-sm font-semibold">
        <Link to="/medicine" className="justify-self-start text-xl font-bold text-slate-900">
          Medicine
        </Link>
        <nav aria-label="Điều hướng Medicine" className="justify-self-center">
          <Link to="/medicine/subjects" className="text-slate-600 hover:text-blue-600">
            Danh sách bệnh nhân
          </Link>
        </nav>
        <div className="justify-self-end">
          <AccountMenu />
        </div>
      </div>
    </header>
    <main className="px-8 py-8">{children}</main>
  </div>
);

export default MedicineLayout;
