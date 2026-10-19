import axiosClient from './axiosClient';
import type { AuthResponse } from '../types/auth';

const authApi = {
  login: (data: { email: string; password: string }) => axiosClient.post<AuthResponse>('/auth/login', data),
  register: (data: { email: string; username: string; password: string }) => axiosClient.post('/auth/register', data),
  googleLogin: (token: string) => axiosClient.post<AuthResponse>('/auth/google', { token }),
  logout: (refreshToken: string) => axiosClient.post('/auth/logout', { refreshToken }),
};

export default authApi;
