import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service.js';
import * as TokenService from '../services/token.service.js';

export const register = async (req: Request, res: Response) => {
  try {
    const user = await AuthService.registerUser(req.body);
    res.status(201).json({ message: "Đăng ký thành công", user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const data = await AuthService.loginUser(email, password);
    res.status(200).json({ message: "Đăng nhập thành công", ...data });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const data = await AuthService.googleLoginUser(token);
    res.status(200).json({ message: "Đăng nhập thành công", ...data });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
}

export const facebookLogin = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const data = await AuthService.facebookLoginUser(token);
    res.status(200).json({ message: "Đăng nhập thành công", ...data });
  } 
  catch (error: any) {
    res.status(401).json({ error: error.message });
  }
}

export const hustLogin = async (req: Request, res: Response) => {
  try {
    const {taikhoan, matkhau} = req.body;
    const data = await AuthService.hustLoginUser(taikhoan, matkhau);
    res.status(200).json({ message: "Đăng nhập thành công", ...data })
  }
  catch (error: any) {
    res.status(401).json({ error: error.message });
  }
}

export const me = async (req: Request, res: Response) => {
  try {
    const user = await AuthService.getCurrentUser((req as any).user.userId);
    res.status(200).json({ user });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
}

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: "Thiếu refresh token" });
  }

  try {
    const data = await TokenService.refreshTokens(refreshToken);
    res.status(200).json(data);
  } catch {
    res.status(401).json({ error: "Refresh token không hợp lệ hoặc đã hết hạn" });
  }
}

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: "Thiếu refresh token" });
  }

  try {
    await TokenService.revokeRefreshToken(refreshToken);
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch {
    res.status(500).json({ error: "Không thể đăng xuất, vui lòng thử lại" });
  }
}
