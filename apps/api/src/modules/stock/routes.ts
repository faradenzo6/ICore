import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

const inSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

const outSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

router.post('/in', authGuard, requireRole('ADMIN', 'STAFF_MANAGER'), async (req, res) => {
  const parsed = inSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const { productId, quantity, unitPrice, note } = parsed.data;

  const userId = req.user!.userId;

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'IN',
        quantity,
        unitPrice: unitPrice ?? null,
        note,
        userId,
      },
    });
    return product;
  });

  res.json(result);
});

router.post('/out', authGuard, requireRole('ADMIN', 'STAFF_MANAGER'), async (req, res) => {
  const parsed = outSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const { productId, quantity, note } = parsed.data;

  const userId = req.user!.userId;

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Товар не найден');
    if (product.stock - quantity < 0) {
      throw Object.assign(new Error('Недостаточно на складе'), { status: 422 });
    }
    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'OUT',
        quantity,
        unitPrice: null,
        note,
        userId,
      },
    });
    return updated;
  });

  res.json(result);
});

router.get('/movements', authGuard, async (req, res) => {
  const { from, to, type, productId } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (type) where.type = type;
  if (productId) where.productId = Number(productId);
  const items = await prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, include: { product: true, user: true } });
  res.json(items);
});


