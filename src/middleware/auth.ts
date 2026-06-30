import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET متغیر محیطی الزامی است');
  }
  console.warn('⚠️ از کلید JWT پیشفرض در محیط توسعه استفاده میشود');
  JWT_SECRET = 'fallback_secret_key_for_development';
}

const PUBLIC_PATHS = new Set([
  '/system/run-seed',
  '/api/system/run-seed',
  '/system/env',
  '/api/system/env',
  '/system/schema-check',
  '/api/system/schema-check',
  '/api/login',
  '/api/auth/login',
  '/api/categories'
]);

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const normalizedPath = req.path.replace(/\/+$/, '');
  if (PUBLIC_PATHS.has(normalizedPath)) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'توکن احراز هویت یافت نشد' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'توکن نامعتبر است یا منقضی شده' });
    }
    (req as any).user = user;
    next();
  });
};

export const generateToken = (payload: any) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};
