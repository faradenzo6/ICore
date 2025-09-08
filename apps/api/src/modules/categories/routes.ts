import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

const schema = z.object({ name: z.string().min(1) });

router.get('/', authGuard, async (_req, res) => {
  const items = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(items);
});

router.get('/:id', authGuard, async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.category.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ message: 'Не найдено' });
  res.json(item);
});

router.post('/', authGuard, requireRole('ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const created = await prisma.category.create({ data: parsed.data });
  res.status(201).json(created);
});

router.put('/:id', authGuard, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const updated = await prisma.category.update({ where: { id }, data: parsed.data });
  res.json(updated);
});

router.delete('/:id', authGuard, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.category.delete({ where: { id } });
  res.json({ message: 'OK' });
});


