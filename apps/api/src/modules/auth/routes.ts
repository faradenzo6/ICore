import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { authGuard } from '../../middlewares/auth';

export const router = Router();

const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 });

router.post('/login', loginLimiter, async (req, res) => {
  // Вход только по логину (username)
  const schema = z.object({
    login: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Некорректные данные' });
  const { login, password } = parsed.data;
  const normalized = login.toLowerCase();
  const user = await prisma.user.findUnique({ where: { username: normalized } });
  if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Неверный логин или пароль' });
  const secret = process.env.JWT_SECRET || 'supersecret';
  const token = jwt.sign({ userId: user.id, role: user.role as any }, secret, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'OK' });
});

router.get('/me', authGuard, async (req, res) => {
  return res.json(req.user);
});


