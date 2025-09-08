import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authGuard } from '../../middlewares/auth';
import { toCsv } from '../../utils/csv';

export const router = Router();

router.get('/summary', authGuard, async (req, res) => {
  const { from, to, bucket = 'day', categoryId: categoryIdStr, category } = req.query as Record<string, string>;

  function keyByBucket(d: Date) {
    const dt = new Date(d);
    if (bucket === 'year') return `${dt.getFullYear()}`;
    if (bucket === 'month') return `${dt.getFullYear()}-${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
    if (bucket === 'week') {
      // ISO week approximation
      const firstJan = new Date(dt.getFullYear(), 0, 1);
      const week = Math.ceil(((dt.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
      return `${dt.getFullYear()}-W${week}`;
    }
    return dt.toISOString().slice(0, 10); // day
  }

  const hasDateFilter = Boolean(from || to);
  const categoryId = Number(categoryIdStr || category);

  if (categoryId) {
    const whereSale: any = {};
    if (hasDateFilter) {
      whereSale.createdAt = {};
      if (from) whereSale.createdAt.gte = new Date(from);
      if (to) whereSale.createdAt.lte = new Date(to);
    }

    const items = await prisma.saleItem.findMany({
      where: {
        sale: whereSale,
        product: { categoryId },
      },
      include: { sale: true },
    });

    const map = new Map<string, { revenue: number; count: number; saleIds: Set<number> }>();
    for (const it of items) {
      const k = keyByBucket(it.sale.createdAt);
      const acc = map.get(k) || { revenue: 0, count: 0, saleIds: new Set<number>() };
      acc.revenue += Number(it.unitPrice) * it.quantity;
      acc.saleIds.add(it.saleId);
      acc.count = acc.saleIds.size;
      map.set(k, acc);
    }

    const rows = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({ period, revenue: v.revenue, count: v.count, avg: v.count ? v.revenue / v.count : 0 }));

    return res.json(rows);
  } else {
    const where: any = {};
    if (hasDateFilter) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const sales = await prisma.sale.findMany({ where });

    const map = new Map<string, { revenue: number; count: number; cash: number; card: number; profit: number }>();
    const saleIds = sales.map((s) => s.id);
    const items = saleIds.length ? await prisma.saleItem.findMany({ where: { saleId: { in: saleIds } }, include: { product: true, sale: true } }) : [];
    const itemsBySale = new Map<number, typeof items>();
    for (const it of items) {
      const arr = itemsBySale.get(it.saleId) || [] as any;
      arr.push(it);
      itemsBySale.set(it.saleId, arr);
    }
    for (const s of sales) {
      const k = keyByBucket(s.createdAt);
      const acc = map.get(k) || { revenue: 0, count: 0, cash: 0, card: 0, profit: 0 };
      acc.revenue += Number(s.total);
      acc.count += 1;
      if (s.paymentMethod === 'cash') acc.cash += Number(s.total);
      if (s.paymentMethod === 'card') acc.card += Number(s.total);
      const saleItems = itemsBySale.get(s.id) || [];
      const profit = saleItems.reduce((p, it) => p + (Number(it.unitPrice) - Number(it.product.costPrice ?? 0)) * it.quantity, 0);
      acc.profit += profit;
      map.set(k, acc);
    }

    const rows = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({ period, revenue: v.revenue, count: v.count, avg: v.count ? v.revenue / v.count : 0, cash: v.cash, card: v.card, profit: v.profit }));

    return res.json(rows);
  }
});

router.get('/top-products', authGuard, async (req, res) => {
  const { from, to, limit = '5', categoryId: categoryIdStr, category } = req.query as Record<string, string>;
  const whereSale: any = {};
  if (from || to) {
    whereSale.createdAt = {};
    if (from) whereSale.createdAt.gte = new Date(from);
    if (to) whereSale.createdAt.lte = new Date(to);
  }
  const categoryId = Number(categoryIdStr || category);
  const items = await prisma.saleItem.findMany({
    where: {
      sale: whereSale,
      ...(categoryId ? { product: { categoryId } } : {}),
    },
    include: { product: true },
  });
  const map = new Map<number, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const acc = map.get(it.productId) || { name: it.product.name, qty: 0, revenue: 0 };
    acc.qty += it.quantity;
    acc.revenue += Number(it.unitPrice) * it.quantity;
    map.set(it.productId, acc);
  }
  const list = Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Number(limit));
  res.json(list);
});

router.get('/stock-export.csv', authGuard, async (_req, res) => {
  const items = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  const rows = items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, price: p.price }));
  const csv = toCsv(rows);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('stock.csv');
  res.send(csv);
});


