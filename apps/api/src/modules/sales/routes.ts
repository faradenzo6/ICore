import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';
import { toCsv } from '../../utils/csv';

export const router = Router();

const saleSchema = z.object({
  items: z.array(
    z.object({
      productId: z.coerce.number().int(),
      quantity: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().nonnegative(),
    })
  ).min(1),
  discount: z.coerce.number().nonnegative().optional(),
  paymentMethod: z.enum(['cash', 'card']).optional(),
});

router.post('/', authGuard, requireRole('ADMIN', 'STAFF_MANAGER', 'STAFF'), async (req, res) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена', issues: parsed.error.flatten() });
    const { items, discount = 0, paymentMethod } = parsed.data;
    const userId = req.user!.userId;

    const result = await prisma.$transaction(async (tx) => {
      // Validate stock in bulk
      const ids = Array.from(new Set(items.map((i) => i.productId)));
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of items) {
        const product = byId.get(it.productId);
        if (!product) throw Object.assign(new Error('Товар не найден'), { status: 404 });
        if (product.stock - it.quantity < 0) {
          throw Object.assign(new Error(`Недостаточно на складе: ${product.name}`), { status: 422 });
        }
      }

      const totalBefore = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const total = Math.max(0, totalBefore - discount);

      const sale = await tx.sale.create({
        data: {
          userId,
          total,
          discount: discount || null,
          paymentMethod: paymentMethod || null,
        },
      });

      await tx.saleItem.createMany({
        data: items.map((it) => ({
          saleId: sale.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      });

      // Parallelize stock updates and movements
      await Promise.all([
        ...items.map((it) => tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } })),
        tx.stockMovement.createMany({
          data: items.map((it) => ({
            productId: it.productId,
            type: 'OUT',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            userId,
          })),
        }),
      ]);

      return sale;
    });

    return res.status(201).json({ id: result.id });
  } catch (err: any) {
    const status = err?.status && Number.isFinite(err.status) ? Number(err.status) : 500;
    return res.status(status).json({ message: err?.message || 'Ошибка оформления продажи' });
  }
});

router.get('/', authGuard, async (req, res) => {
  const { from, to, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  const take = Number(limit);
  const skip = (Number(page) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.sale.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.sale.count({ where }),
  ]);
  res.json({ items, total, page: Number(page), limit: take });
});

router.get('/:id', authGuard, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Некорректный id' });
  const sale = await prisma.sale.findUnique({ where: { id }, include: { items: { include: { product: true } }, user: true } });
  if (!sale) return res.status(404).json({ message: 'Не найдено' });
  res.json(sale);
});

router.get('/:id/receipt.csv', authGuard, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Некорректный id' });
  const sale = await prisma.sale.findUnique({ where: { id }, include: { items: { include: { product: true } }, user: true } });
  if (!sale) return res.status(404).json({ message: 'Не найдено' });
  const rows = [
    { Товар: 'Название', Цена: 'Цена', Количество: 'Кол-во', Сумма: 'Сумма' },
    ...sale.items.map((i) => ({
      Товар: i.product.name,
      Цена: i.unitPrice,
      Количество: i.quantity,
      Сумма: Number(i.unitPrice) * i.quantity,
    })),
    { Товар: 'Итого до скидки', Цена: '', Количество: '', Сумма: sale.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) },
    { Товар: 'Скидка', Цена: '', Количество: '', Сумма: sale.discount ?? 0 },
    { Товар: 'Итого', Цена: '', Количество: '', Сумма: Number(sale.total) },
  ];
  const csv = toCsv(rows as any);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`receipt_${sale.id}.csv`);
  res.send(csv);
});

router.get('/export.csv', authGuard, async (_req, res) => {
  const items = await prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true, user: true } });
  const rows = items.map((s) => ({
    id: s.id,
    userId: s.userId,
    total: s.total,
    discount: s.discount ?? 0,
    paymentMethod: s.paymentMethod ?? '',
    createdAt: s.createdAt.toISOString(),
  }));
  const csv = toCsv(rows);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('sales.csv');
  res.send(csv);
});


