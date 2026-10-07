import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authApi from '../api/authApi';
import { AuthForm } from './AuthForm';

type RegisterFields = 'email' | 'username' | 'password' | 'confirmPassword';

export const RegisterForm = () => {
  const [formData, setFormData] = useState<Record<RegisterFields, string>>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const navigate = useNavigate();
  const [error, setError] = useState('');

  const fields = [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    {
      name: 'username',
      label: 'Tên đăng nhập',
      type: 'text',
      autoComplete: 'username',
    },
    {
      name: 'password',
      label: 'Mật khẩu',
      type: 'password',
      autoComplete: 'new-password',
    },
    {
      name: 'confirmPassword',
      label: 'Xác nhận mật khẩu',
      type: 'password',
      autoComplete: 'new-password',
    },
  ] as const;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Kiểm tra mật khẩu khớp
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    try {
      await authApi.register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });
      navigate('/login');
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      const message = apiError.response?.data?.error ?? 'Đăng ký thất bại';

      setError(message);
    }
  };

  return (
    <AuthForm
      title="Tạo tài khoản mới"
      submitLabel="Đăng ký"
      values={formData}
      fields={fields}
      error={error}
      onError={setError}
      onSubmit={handleSubmit}
      onChange={(name, value) => {
        setError('');
        setFormData((prev) => ({ ...prev, [name]: value }));
      }}
      footer={
        <p>
          Đã có tài khoản?{' '}
          <Link className="font-semibold text-blue-700 hover:underline" to="/login">
            Đăng nhập ngay
          </Link>
        </p>
      }
    />
  );
};
