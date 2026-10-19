import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// 1. Hàm xác thực Token (Để biết người dùng là ai)
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Bạn chưa đăng nhập (Thiếu Token)" });
    }

    // Chỉ chấp nhận access token (JWT). Refresh token là chuỗi ngẫu nhiên nên luôn bị từ chối ở đây.
    // Trả 401 để frontend biết cần gọi /api/auth/refresh; 403 dành cho thiếu quyền.
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        (req as any).user = decoded; // Lưu thông tin giải mã (id, permissions...) vào req.user
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: "Access token đã hết hạn" });
        }
        return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
};

export const checkPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        
        const userPermissions: string[] = user?.permissions || [];

        if (userPermissions.includes(permission)) {
            next(); // Có quyền -> Cho phép đi tiếp
        } 
        else {
            return res.status(403).json({
                error: `Bạn không có quyền truy cập: ${permission}`
            });
        }
    };
};