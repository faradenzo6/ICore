import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1).optional(),
  categoryId: z.number().int().optional().nullable(),
  price: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  imageUrl: z.string().url().optional().nullable(),
  stock: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  packSize: z.number().int().positive().optional(),
  isComposite: z.boolean().optional(),
  bunComponentId: z.number().int().optional().nullable(),
  sausageComponentId: z.number().int().optional().nullable(),
  sausagesPerUnit: z.number().int().positive().optional(),
});

router.get('/', authGuard, async (req, res) => {
  const { search = '', category, page = '1', limit = '20', active } = req.query as Record<string, string>;
  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.categoryId = Number(category);
  if (active !== undefined) where.isActive = active === 'true';
  const take = Number(limit);
  const skip = (Number(page) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { category: true } }),
    prisma.product.count({ where }),
  ]);
  res.json({ items, total, page: Number(page), limit: take });
});

router.get('/:id', authGuard, async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!item) return res.status(404).json({ message: 'Не найдено' });
  res.json(item);
});

router.post('/', authGuard, requireRole('ADMIN'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const data = parsed.data;
  // auto SKU if not provided
  let sku = data.sku;
  if (!sku) {
    const base = data.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'ITEM';
    sku = base;
    let i = 1;
    while (await prisma.product.findUnique({ where: { sku } })) {
      sku = `${base}${(++i).toString().padStart(2, '0')}`;
    }
  }
  const created = await prisma.product.create({ data: {
    name: data.name,
    sku,
    categoryId: data.categoryId ?? undefined,
    price: data.price ?? 0,
    costPrice: data.costPrice ?? 0,
    imageUrl: data.imageUrl ?? undefined,
    stock: data.stock ?? 0,
    isActive: data.isActive ?? true,
    packSize: data.packSize ?? 1,
    isComposite: data.isComposite ?? false,
    bunComponentId: data.bunComponentId ?? null,
    sausageComponentId: data.sausageComponentId ?? null,
    sausagesPerUnit: data.sausagesPerUnit ?? null,
  }});
  res.status(201).json(created);
});

router.put('/:id', authGuard, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const data = parsed.data;
  const updated = await prisma.product.update({ where: { id }, data: {
    ...data,
    categoryId: data.categoryId ?? undefined,
    costPrice: data.costPrice ?? undefined,
    imageUrl: data.imageUrl ?? undefined,
    packSize: data.packSize ?? undefined,
    isComposite: data.isComposite ?? undefined,
    bunComponentId: data.bunComponentId ?? undefined,
    sausageComponentId: data.sausageComponentId ?? undefined,
    sausagesPerUnit: data.sausagesPerUnit ?? undefined,
  }});
  res.json(updated);
});

router.delete('/:id', authGuard, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'OK' });
  } catch (err: any) {
    // Объясняем FK-ошибку человеку
    if (err?.code === 'P2003') {
      return res.status(409).json({ message: 'Нельзя удалить товар: есть связанные продажи или движения склада' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Ошибка удаления' });
  }
});


