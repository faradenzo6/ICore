import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type JwtPayload = {
  userId: number;
  role: 'ADMIN' | 'STAFF';
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    console.log('[auth] Cookie не найдена. Cookies:', req.cookies);
    return res.status(401).json({ message: 'Не авторизован' });
  }
  try {
    const secret = process.env.JWT_SECRET || 'supersecret';
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    return next();
  } catch (e) {
    console.log('[auth] Ошибка верификации токена:', e);
    return res.status(401).json({ message: 'Сессия недействительна' });
  }
}

export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Не авторизован' });
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: 'Недостаточно прав' });
  };
}


