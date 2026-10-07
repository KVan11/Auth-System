import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service.js';

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
