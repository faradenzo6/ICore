import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

const roleEnum = z.enum(['ADMIN', 'STAFF']);
const createSchema = z.object({ username: z.string().min(1), password: z.string().min(1), role: roleEnum });
const updateSchema = z.object({ password: z.string().min(1).optional(), role: roleEnum.optional(), username: z.string().min(1).optional(), email: z.string().min(1).optional() });

router.use(authGuard, requireRole('ADMIN'));

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt })));
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const { username, password, role } = parsed.data;
  const email = `${username.toLowerCase()}@local`;
  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (exists) return res.status(409).json({ message: 'Пользователь уже существует' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, username, passwordHash, role } });
  res.status(201).json({ id: user.id, email: user.email, username: user.username, role: user.role });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const data: any = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (parsed.data.username) data.username = parsed.data.username;
  if (parsed.data.email) data.email = parsed.data.email;
  const user = await prisma.user.update({ where: { id }, data });
  res.json({ id: user.id, email: user.email, username: user.username, role: user.role });
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'OK' });
  } catch (e: any) {
    if (e?.code === 'P2003') {
      return res.status(409).json({ message: 'Невозможно удалить: есть связанные записи (продажи/операции).' });
    }
    console.error(e);
    return res.status(500).json({ message: 'Не удалось удалить пользователя' });
  }
});


