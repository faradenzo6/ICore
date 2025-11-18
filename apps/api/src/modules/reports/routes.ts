import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authGuard } from '../../middlewares/auth';
import { toCsv } from '../../utils/csv';
import { sendMonthlyReport } from '../../lib/telegram';

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
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        whereSale.createdAt.lte = toDate;
      }
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
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
    const sales = await prisma.sale.findMany({ where });

    const map = new Map<string, { revenue: number; count: number; cash: number; card: number; credit: number; profit: number; creditUnpaid: number }>();
    const saleIds = sales.map((s: { id: number }) => s.id);
    const items = saleIds.length ? await prisma.saleItem.findMany({ where: { saleId: { in: saleIds } }, include: { product: true, sale: true } }) : [] as any[];
    const phoneSales = saleIds.length ? await prisma.phoneSale.findMany({ where: { saleId: { in: saleIds } }, include: { phone: true, sale: true } }) : [] as any[];
    const creditPayments = saleIds.length ? await prisma.creditPayment.findMany({ where: { saleId: { in: saleIds } } }) : [] as any[];
    const itemsBySale = new Map<number, typeof items>();
    const phoneSalesBySale = new Map<number, typeof phoneSales>();
    const paymentsBySale = new Map<number, typeof creditPayments>();
    for (const it of items) {
      const arr = itemsBySale.get(it.saleId) || [] as any;
      arr.push(it);
      itemsBySale.set(it.saleId, arr);
    }
    for (const ps of phoneSales) {
      const arr = phoneSalesBySale.get(ps.saleId) || [] as any;
      arr.push(ps);
      phoneSalesBySale.set(ps.saleId, arr);
    }
    for (const cp of creditPayments) {
      const arr = paymentsBySale.get(cp.saleId) || [] as any;
      arr.push(cp);
      paymentsBySale.set(cp.saleId, arr);
    }
    for (const s of sales) {
      const k = keyByBucket(s.createdAt);
      const acc = map.get(k) || { revenue: 0, count: 0, cash: 0, card: 0, credit: 0, profit: 0, creditUnpaid: 0 };
      acc.revenue += Number(s.total);
      acc.count += 1;
      if (s.paymentMethod === 'cash') acc.cash += Number(s.total);
      if (s.paymentMethod === 'card') acc.card += Number(s.total);
      if (s.paymentMethod === 'credit') {
        acc.credit += Number(s.total);
        // Вычисляем неоплаченную сумму для кредита
        const totalPaid = Number(s.initialPayment || 0) + (paymentsBySale.get(s.id) || []).reduce((sum: number, p: { amount: any }) => sum + Number(p.amount), 0);
        const remaining = Number(s.total) - totalPaid;
        acc.creditUnpaid += remaining;
      }
      const saleItems: Array<{ unitPrice: any; unitCost?: any; product: { isComposite?: boolean; costPrice?: any }; quantity: number }> = itemsBySale.get(s.id) || [];
      const phoneSalesForSale: Array<{ salePrice: any; purchasePrice: any }> = phoneSalesBySale.get(s.id) || [];
      const paymentsForSale: Array<{ amount: any }> = paymentsBySale.get(s.id) || [];
      
      // Прибыль считаем по зафиксированной себестоимости на момент продажи
      // Если товар составной (Хот-Дог), прибыль считаем как цена продажи минус себестоимость, но себестоимость компонентов не включаем, т.к. она учитывается отдельно на складе
      let profit = saleItems.reduce((p, it) => {
        const unitCost = (it.product as any).isComposite ? 0 : Number(it.unitCost ?? it.product.costPrice ?? 0);
        return p + (Number(it.unitPrice) - unitCost) * it.quantity;
      }, 0);
      
      // Добавляем прибыль от продаж телефонов
      // Для кредита учитываем только оплаченную часть
      if (s.paymentMethod === 'credit' && phoneSalesForSale.length > 0) {
        // Вычисляем оплаченную сумму для кредита
        const totalPaid = Number(s.initialPayment || 0) + paymentsForSale.reduce((sum, p) => sum + Number(p.amount), 0);
        const purchasePrice = phoneSalesForSale[0].purchasePrice;
        // Прибыль = оплаченная сумма - себестоимость (пропорционально оплаченной части)
        // Но если оплачено меньше себестоимости, то прибыль отрицательная
        profit += totalPaid - Number(purchasePrice);
      } else {
        // Для налички и карты считаем как обычно
        profit += phoneSalesForSale.reduce((p, ps) => {
          return p + (Number(ps.salePrice) - Number(ps.purchasePrice));
        }, 0);
      }
      
      acc.profit += profit;
      map.set(k, acc);
    }

    const rows = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({ period, revenue: v.revenue, count: v.count, avg: v.count ? v.revenue / v.count : 0, cash: v.cash, card: v.card, credit: v.credit, profit: v.profit, creditUnpaid: v.creditUnpaid }));

    return res.json(rows);
  }
});

router.get('/top-products', authGuard, async (req, res) => {
  const { from, to, limit = '5', categoryId: categoryIdStr, category } = req.query as Record<string, string>;
  const whereSale: any = {};
  if (from || to) {
    whereSale.createdAt = {};
    if (from) whereSale.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      whereSale.createdAt.lte = toDate;
    }
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
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, Number(limit));
  res.json(list);
});

router.get('/stock-export.csv', authGuard, async (_req, res) => {
  const items = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  const rows = items.map((p: { id: number; name: string; sku: string; stock: number; price: any }) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, price: p.price }));
  const csv = toCsv(rows);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('stock.csv');
  res.send(csv);
});

router.get('/stock-export.xlsx', authGuard, async (_req, res) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Остатки');
  sheet.columns = [
    { header: 'Название', key: 'name', width: 32 },
    { header: 'Остаток', key: 'stock', width: 12 },
    { header: 'Цена закупки', key: 'cost', width: 16 },
    { header: 'Цена продажи', key: 'price', width: 16 },
  ];
  const items = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  items.forEach((p: any) => sheet.addRow({ name: p.name, stock: p.stock, cost: Number(p.costPrice), price: Number(p.price) }));
  sheet.getRow(1).font = { bold: true };
  ;['cost','price'].forEach((k) => { (sheet.getColumn(k as any) as any).numFmt = '#,##0'; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="stock.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/export.xlsx', authGuard, async (req, res) => {
  const { from, to, bucket = 'day' } = req.query as Record<string, string>;
  
  function keyByBucket(d: Date) {
    const dt = new Date(d);
    if (bucket === 'year') return `${dt.getFullYear()}`;
    if (bucket === 'month') return `${dt.getFullYear()}-${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
    if (bucket === 'week') {
      const firstJan = new Date(dt.getFullYear(), 0, 1);
      const week = Math.ceil(((dt.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
      return `${dt.getFullYear()}-W${week}`;
    }
    return dt.toISOString().slice(0, 10);
  }

  const hasDateFilter = Boolean(from || to);
  const where: any = {};
  if (hasDateFilter) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }
  const sales = await prisma.sale.findMany({ where });
  const saleIds = sales.map((s: { id: number }) => s.id);
  const items = saleIds.length ? await prisma.saleItem.findMany({ where: { saleId: { in: saleIds } }, include: { product: true, sale: true } }) : [] as any[];
  const phoneSales = saleIds.length ? await prisma.phoneSale.findMany({ where: { saleId: { in: saleIds } }, include: { phone: true, sale: true } }) : [] as any[];
  const creditPayments = saleIds.length ? await prisma.creditPayment.findMany({ where: { saleId: { in: saleIds } } }) : [] as any[];
  const itemsBySale = new Map<number, typeof items>();
  const phoneSalesBySale = new Map<number, typeof phoneSales>();
  const paymentsBySale = new Map<number, typeof creditPayments>();
  for (const it of items) {
    const arr = itemsBySale.get(it.saleId) || [] as any;
    arr.push(it);
    itemsBySale.set(it.saleId, arr);
  }
  for (const ps of phoneSales) {
    const arr = phoneSalesBySale.get(ps.saleId) || [] as any;
    arr.push(ps);
    phoneSalesBySale.set(ps.saleId, arr);
  }
  for (const cp of creditPayments) {
    const arr = paymentsBySale.get(cp.saleId) || [] as any;
    arr.push(cp);
    paymentsBySale.set(cp.saleId, arr);
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Отчёт');
  sheet.columns = [
    { header: 'Период', key: 'period', width: 20 },
    { header: 'Наличные', key: 'cash', width: 16 },
    { header: 'Карта', key: 'card', width: 16 },
    { header: 'Кредит (оплачено)', key: 'credit', width: 20 },
    { header: 'Кредит (неоплачено)', key: 'creditUnpaid', width: 20 },
    { header: 'Общая сумма', key: 'revenue', width: 16 },
    { header: 'Чистая прибыль', key: 'profit', width: 18 },
    { header: 'Количество продаж', key: 'count', width: 18 },
  ];

  const map = new Map<string, { revenue: number; count: number; cash: number; card: number; credit: number; profit: number; creditUnpaid: number }>();
  for (const s of sales) {
    const k = keyByBucket(s.createdAt);
    const acc = map.get(k) || { revenue: 0, count: 0, cash: 0, card: 0, credit: 0, profit: 0, creditUnpaid: 0 };
    acc.revenue += Number(s.total);
    acc.count += 1;
    if (s.paymentMethod === 'cash') acc.cash += Number(s.total);
    if (s.paymentMethod === 'card') acc.card += Number(s.total);
    if (s.paymentMethod === 'credit') {
      acc.credit += Number(s.total);
      const totalPaid = Number(s.initialPayment || 0) + (paymentsBySale.get(s.id) || []).reduce((sum: number, p: { amount: any }) => sum + Number(p.amount), 0);
      const remaining = Number(s.total) - totalPaid;
      acc.creditUnpaid += remaining;
    }
    const saleItems: Array<{ unitPrice: any; unitCost?: any; product: { isComposite?: boolean; costPrice?: any }; quantity: number }> = itemsBySale.get(s.id) || [];
    const phoneSalesForSale: Array<{ salePrice: any; purchasePrice: any }> = phoneSalesBySale.get(s.id) || [];
    const paymentsForSale: Array<{ amount: any }> = paymentsBySale.get(s.id) || [];
    
    let profit = saleItems.reduce((p, it) => {
      const unitCost = (it.product as any).isComposite ? 0 : Number(it.unitCost ?? it.product.costPrice ?? 0);
      return p + (Number(it.unitPrice) - unitCost) * it.quantity;
    }, 0);
    
    if (s.paymentMethod === 'credit' && phoneSalesForSale.length > 0) {
      const totalPaid = Number(s.initialPayment || 0) + paymentsForSale.reduce((sum, p) => sum + Number(p.amount), 0);
      const purchasePrice = phoneSalesForSale[0].purchasePrice;
      profit += totalPaid - Number(purchasePrice);
    } else {
      profit += phoneSalesForSale.reduce((p, ps) => {
        return p + (Number(ps.salePrice) - Number(ps.purchasePrice));
      }, 0);
    }
    
    acc.profit += profit;
    map.set(k, acc);
  }

  const rows = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      cash: v.cash,
      card: v.card,
      credit: v.credit,
      creditUnpaid: v.creditUnpaid,
      revenue: v.revenue,
      profit: v.profit,
      count: v.count,
    }));

  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  ['cash', 'card', 'credit', 'creditUnpaid', 'revenue', 'profit'].forEach((k) => {
    (sheet.getColumn(k as any) as any).numFmt = '#,##0';
  });

  const fromStr = from ? new Date(from).toLocaleDateString('ru-RU') : '';
  const toStr = to ? new Date(to).toLocaleDateString('ru-RU') : '';
  const filename = `report_${fromStr || 'all'}_${toStr || 'all'}.xlsx`.replace(/\//g, '-');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

// Endpoint для отправки ежемесячного отчёта в Telegram
router.post('/monthly-telegram', authGuard, async (req, res) => {
  try {
    await sendMonthlyReport();
    res.json({ message: 'Ежемесячный отчёт отправлен в Telegram' });
  } catch (error) {
    console.error('[reports] Ошибка отправки ежемесячного отчёта:', error);
    res.status(500).json({ message: 'Ошибка отправки отчёта' });
  }
});

// Тестовый endpoint без авторизации для проверки
router.post('/test-monthly-telegram', async (req, res) => {
  try {
    await sendMonthlyReport();
    res.json({ message: 'Тестовый ежемесячный отчёт отправлен в Telegram' });
  } catch (error) {
    console.error('[reports] Ошибка отправки тестового отчёта:', error);
    res.status(500).json({ message: 'Ошибка отправки отчёта' });
  }
});


