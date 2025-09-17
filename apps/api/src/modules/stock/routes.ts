import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';
import { notifyStockIn, notifyStockOut } from '../../lib/telegram';

export const router = Router();

const inSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(), // цена закупки за упаковку/единицу
  salePrice: z.number().nonnegative().optional(), // цена продажи
  note: z.string().optional(),
});

const outSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

router.post('/in', authGuard, requireRole('ADMIN'), async (req, res) => {
  const parsed = inSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const { productId, quantity, unitPrice, salePrice, note } = parsed.data;

  const userId = req.user!.userId;

  const result = await prisma.$transaction(async (tx: any) => {
    const existing = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
    if (!existing) throw new Error('Товар не найден');

    // Автоправило: если packSize не задан, применяем дефолты
    const name = (existing.name || '').toLowerCase();
    const isSausage = name.includes('сосиск');
    const isBread = name.includes('лепёш') || name.includes('лепеш');
    const defaultPackSize = existing.packSize && existing.packSize > 1
      ? existing.packSize
      : (existing.category?.name === 'Сосиски' || isSausage ? 12 : (existing.category?.name === 'Лепёшки' || isBread ? 2 : 1));

    const multiplier = Math.max(1, defaultPackSize);
    const effectiveQty = quantity * multiplier; // кладём на склад в штуках
    const costPerUnit = unitPrice !== undefined ? Number(unitPrice) / multiplier : undefined;

    const product = await tx.product.update({
      where: { id: productId },
      data: {
        stock: { increment: effectiveQty },
        ...(costPerUnit !== undefined ? { costPrice: costPerUnit } : {}),
        ...(salePrice !== undefined ? { price: salePrice } : {}),
        ...(existing.packSize !== multiplier ? { packSize: multiplier } : {}),
      },
    });
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'IN',
        quantity: effectiveQty,
        unitPrice: salePrice !== undefined ? Number(salePrice) : null, // сохраняем цену продажи если указана
        unitCost: costPerUnit ?? null,
        note,
        userId,
      },
    });
    return product;
  });

  // Отправляем уведомление о поступлении
  notifyStockIn(productId, quantity, unitPrice, userId).catch(error => {
    console.error('[telegram] Ошибка уведомления о поступлении:', error);
  });

  res.json(result);
});

router.post('/out', authGuard, requireRole('ADMIN'), async (req, res) => {
  const parsed = outSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена' });
  const { productId, quantity, note } = parsed.data;

  const userId = req.user!.userId;

  const result = await prisma.$transaction(async (tx: any) => {
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

  // Отправляем уведомление о списании
  notifyStockOut(productId, quantity, note, userId).catch(error => {
    console.error('[telegram] Ошибка уведомления о списании:', error);
  });

  res.json(result);
});

router.get('/movements', authGuard, async (req, res) => {
  const { from, to, type, productId, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (type) where.type = type;
  if (productId) where.productId = Number(productId);
  
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNum - 1) * limitNum;
  
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({ 
      where, 
      orderBy: { createdAt: 'desc' }, 
      include: { product: true, user: true },
      skip,
      take: limitNum
    }),
    prisma.stockMovement.count({ where })
  ]);
  
  res.json({ items, total, page: pageNum, limit: limitNum });
});


