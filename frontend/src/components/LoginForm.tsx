import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../api/authApi';
import { AuthForm } from './AuthForm';

type LoginFields = 'email' | 'password';

export const LoginForm = () => {
  const [formData, setFormData] = useState<Record<LoginFields, string>>({
    email: '',
    password: '',
  });
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const fields = [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    {
      name: 'password',
      label: 'Mật khẩu',
      type: 'password',
      autoComplete: 'current-password',
    },
  ] as const;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    try {
      const res = await authApi.login(formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/profile'); // Về trang chủ
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } };
      const message = apiError.response?.data?.error ?? 'Đăng nhập thất bại';

      setError(message);
    }
  };

  return (
    <AuthForm
      title="Đăng nhập"
      submitLabel="Đăng nhập"
      values={formData}
      fields={fields}
      error={error}
      onError={setError}
      onSubmit={handleSubmit}
      onChange={(name, value) => {
        setError('');
        setFormData((prev) => ({ ...prev, [name]: value }));
      }}
    />
  );
};
