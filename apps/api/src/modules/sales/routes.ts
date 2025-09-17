import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';
import { toCsv } from '../../utils/csv';
import { fetch, dispatcher } from '../../lib/http';

// Функция для отправки уведомлений в Telegram
async function sendTelegramNotification(saleId: number, items: any[], userId: number) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '8475679792:AAHVGHAfx3hIoSPOPMAqcJSnkOlbHpzgJzs';
    const chatId = process.env.TELEGRAM_CHAT_ID || '-4614810639';
    const httpsProxy = process.env.HTTPS_PROXY;
    
    if (!token || !chatId) {
      console.log('[telegram] Токен или chat_id не настроены');
      return;
    }

    console.log('[telegram] Начинаем отправку уведомлений для продажи:', saleId);
    if (httpsProxy) {
      console.log('[telegram] Используется прокси:', httpsProxy);
    } else {
      console.log('[telegram] Прокси не настроен, используется прямое подключение');
    }

    // Получаем данные о продаже и товарах
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        user: { select: { username: true } },
        items: {
          include: {
            product: {
              include: {
                bunComponent: true,
                sausageComponent: true
              }
            }
          }
        }
      }
    });

    if (!sale) {
      console.error('[telegram] Продажа не найдена:', saleId);
      return;
    }

    const now = new Date().toLocaleString('ru-RU');
    
    // Отправляем уведомление для каждого товара
    for (const item of sale.items) {
      const product = item.product;
      
      let text = `🛒 <b>${product.name}</b>\n` +
        `📦 Количество: <b>${item.quantity}</b>\n` +
        `💰 Цена продажи: <b>${Number(item.unitPrice).toLocaleString('ru-RU')} UZS</b>\n` +
        `📅 Дата и время продажи: <b>${now}</b>\n` +
        `👤 Логин продавшего: <b>${sale.user?.username ?? ''}</b>\n`;
      
      if (product.isComposite) {
        text += `📊 Остаток проданного товара: <b>—</b>\n`;
        
        // Добавляем информацию об остатках компонентов для хот-догов
        if (product.bunComponent) {
          text += `🥖 Остаток лепёшек: <b>${product.bunComponent.stock}</b>\n`;
        }
        if (product.sausageComponent) {
          text += `🌭 Остаток сосисок: <b>${product.sausageComponent.stock}</b>\n`;
        }
      } else {
        text += `📊 Остаток проданного товара: <b>${product.stock}</b>\n`;
      }
      
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text, 
          parse_mode: 'HTML', 
          disable_web_page_preview: true 
        }),
        dispatcher,  // Используем dispatcher с поддержкой прокси
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[telegram] Ошибка отправки сообщения:', response.status, response.statusText, errorText);
      } else {
        console.log('[telegram] Сообщение успешно отправлено для товара:', product.name);
      }
    }
    
    console.log('[telegram] Уведомления отправлены для продажи:', saleId);
  } catch (error) {
    console.error('[telegram] Ошибка отправки уведомлений:', error);
  }
}

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
  // Сделать способ оплаты обязательным
  paymentMethod: z.enum(['cash', 'card']),
});

router.post('/', authGuard, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: 'Валидация не пройдена', issues: parsed.error.flatten() });
    const { items, discount = 0, paymentMethod } = parsed.data;
    const userId = req.user!.userId;

    const result = await prisma.$transaction(async (tx: any) => {
      // Validate stock in bulk (с учётом составных товаров)
      const ids = Array.from(new Set(items.map((i) => i.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        include: { bunComponent: true, sausageComponent: true },
      });
      const byId = new Map(products.map((p: any) => [p.id, p]));
      for (const it of items) {
        const product = byId.get(it.productId) as any;
        if (!product) throw Object.assign(new Error('Товар не найден'), { status: 404 });
        if (product.isComposite) {
          if (!product.bunComponent || !product.sausageComponent) {
            throw Object.assign(new Error('Составной товар настроен некорректно'), { status: 422 });
          }
          const sausagesPerUnit = product.sausagesPerUnit || 1;
          // Списываем половинки лепёшки и единичные сосиски
          const needBuns = it.quantity * 1; // 1 половина лепёшки на хот-дог
          const needSausages = it.quantity * sausagesPerUnit; // штуки, не пачки
          if (product.bunComponent.stock - needBuns < 0) {
            throw Object.assign(new Error(`Недостаточно лепёшек: ${product.bunComponent.name}`), { status: 422 });
          }
          if (product.sausageComponent.stock - needSausages < 0) {
            throw Object.assign(new Error(`Недостаточно сосисок: ${product.sausageComponent.name}`), { status: 422 });
          }
        } else {
          if (product.stock - it.quantity < 0) {
            throw Object.assign(new Error(`Недостаточно на складе: ${product.name}`), { status: 422 });
          }
        }
      }

      const totalBefore = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const total = Math.max(0, totalBefore - discount);

      const sale = await tx.sale.create({
        data: {
          userId,
          total,
          discount: discount || null,
          paymentMethod,
        },
      });

      // Фиксируем себестоимость на момент продажи (для составных считаем как сумма компонентов)
      const productsAtSale = await tx.product.findMany({ where: { id: { in: ids } }, include: { bunComponent: true, sausageComponent: true } });
      const productCostById = new Map<number, any>();
      for (const p of productsAtSale) {
        if (p.isComposite && p.bunComponent && p.sausageComponent) {
          const sausagesPerUnit = p.sausagesPerUnit || 1;
          // По требованиям прибыль по хот-догу не учитывает стоимость компонентов
          const cost = 0;
          productCostById.set(p.id, cost);
        } else {
          productCostById.set(p.id, p.costPrice);
        }
      }

      await tx.saleItem.createMany({
        data: items.map((it) => ({
          saleId: sale.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitCost: productCostById.get(it.productId) ?? null,
        })),
      });

      // Обновляем склад (для составных — списываем компоненты)
      const stockOps: Promise<any>[] = [];
      for (const it of items) {
        const product = byId.get(it.productId)! as any;
        if (product.isComposite && product.bunComponentId && product.sausageComponentId) {
          const sausagesPerUnit = product.sausagesPerUnit || 1;
          stockOps.push(
            tx.product.update({ where: { id: product.bunComponentId }, data: { stock: { decrement: it.quantity * 1 } } }),
            tx.product.update({ where: { id: product.sausageComponentId }, data: { stock: { decrement: it.quantity * sausagesPerUnit } } }),
          );
        } else {
          stockOps.push(tx.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } }));
        }
      }

      await Promise.all([
        ...stockOps,
        tx.stockMovement.createMany({
          data: items.map((it) => ({
            productId: it.productId,
            type: 'SALE',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCost: productCostById.get(it.productId) ?? null,
            userId,
          })),
        }),
      ]);


      return sale;
    });

    // Отправляем уведомления в Telegram после успешной продажи
    // Выполняем асинхронно, чтобы не блокировать ответ клиенту
    sendTelegramNotification(result.id, items, userId).catch(error => {
      console.error('[telegram] Критическая ошибка отправки уведомлений:', error);
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

// Экспорт Excel/CSV должен идти ДО роутов с :id, иначе захватывается как id
router.get('/export.csv', authGuard, async (_req, res) => {
  const items = await prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true, user: true } });
  const rows = items.map((s: any) => ({
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

// Excel экспорт (XLSX) — обязательно выше маршрутов с ":id"
router.get('/export.xlsx', authGuard, async (_req, res) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // Лист 1: свод по продажам
  const salesSheet = workbook.addWorksheet('Продажи');
  salesSheet.columns = [
    { header: 'Дата', key: 'createdAt', width: 14 },
    { header: 'Товары', key: 'items', width: 50 },
    { header: 'Способ оплаты', key: 'paymentMethod', width: 16 },
    { header: 'До скидки', key: 'before', width: 14 },
    { header: 'Скидка', key: 'discount', width: 14 },
    { header: 'Итого', key: 'total', width: 14 },
    { header: 'Чистая прибыль', key: 'profit', width: 16 },
  ];

  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, items: { include: { product: true } } },
  });

  sales.forEach((s: any) => {
    const mapPay = (p?: string | null) => (p === 'cash' ? 'Наличные' : p === 'card' ? 'Картой' : '');
    const before = s.items.reduce((sum: any, it: any) => sum + Number(it.unitPrice) * it.quantity, 0);
    const profit = s.items.reduce((sum: any, it: any) => {
      const unitCost = (it.product?.isComposite ? 0 : Number(it.unitCost ?? it.product?.costPrice ?? 0)) || 0;
      return sum + (Number(it.unitPrice) - unitCost) * it.quantity;
    }, 0);
    const itemsText = s.items.map((it: any) => `${it.product.name} ×${it.quantity}`).join(', ');
    salesSheet.addRow({
      createdAt: s.createdAt,
      items: itemsText,
      paymentMethod: mapPay(s.paymentMethod),
      before,
      discount: Number(s.discount ?? 0),
      total: Number(s.total),
      profit,
    });
  });

  // Форматирование
  salesSheet.getRow(1).font = { bold: true };
  ;['before','discount','total','profit'].forEach((k) => { (salesSheet.getColumn(k as any) as any).numFmt = '#,##0'; });
  salesSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  salesSheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Итоги
  const lastRow = salesSheet.rowCount + 1;
  salesSheet.addRow({});
  salesSheet.addRow({ createdAt: 'ИТОГО:' });
  const sumRowIdx = salesSheet.rowCount;
  salesSheet.getCell(`D${sumRowIdx}`).value = { formula: `SUM(D2:D${sumRowIdx-1})` } as any;
  salesSheet.getCell(`E${sumRowIdx}`).value = { formula: `SUM(E2:E${sumRowIdx-1})` } as any;
  salesSheet.getCell(`F${sumRowIdx}`).value = { formula: `SUM(F2:F${sumRowIdx-1})` } as any;
  salesSheet.getCell(`G${sumRowIdx}`).value = { formula: `SUM(G2:G${sumRowIdx-1})` } as any;
  salesSheet.getRow(sumRowIdx).font = { bold: true };

  // Лист 2: позиции чеков
  const itemsSheet = workbook.addWorksheet('Позиции');
  itemsSheet.columns = [
    { header: 'Дата', key: 'createdAt', width: 14 },
    { header: 'Товар', key: 'product', width: 40 },
    { header: 'Кол-во', key: 'qty', width: 10 },
    { header: 'Цена', key: 'price', width: 12 },
    { header: 'Себестоимость', key: 'cost', width: 16 },
    { header: 'Прибыль', key: 'profit', width: 14 },
    { header: 'Сумма', key: 'sum', width: 14 },
  ];
  for (const s of sales) {
    for (const it of s.items) {
      const unitCost = (it.product as any)?.isComposite ? 0 : Number((it as any).unitCost ?? (it.product as any)?.costPrice ?? 0);
      const profit = (Number(it.unitPrice) - unitCost) * it.quantity;
      itemsSheet.addRow({
        createdAt: s.createdAt,
        product: it.product.name,
        qty: it.quantity,
        price: Number(it.unitPrice),
        cost: unitCost,
        profit,
        sum: Number(it.unitPrice) * it.quantity,
      });
    }
  }
  itemsSheet.getRow(1).font = { bold: true };
  ;['price','cost','profit','sum'].forEach((k) => { (itemsSheet.getColumn(k as any) as any).numFmt = '#,##0'; });
  itemsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  itemsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sales.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
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
    ...sale.items.map((i: any) => ({
      Товар: i.product.name,
      Цена: i.unitPrice,
      Количество: i.quantity,
      Сумма: Number(i.unitPrice) * i.quantity,
    })),
    { Товар: 'Итого до скидки', Цена: '', Количество: '', Сумма: sale.items.reduce((s: any, i: any) => s + Number(i.unitPrice) * i.quantity, 0) },
    { Товар: 'Скидка', Цена: '', Количество: '', Сумма: sale.discount ?? 0 },
    { Товар: 'Итого', Цена: '', Количество: '', Сумма: Number(sale.total) },
  ];
  const csv = toCsv(rows as any);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`receipt_${sale.id}.csv`);
  res.send(csv);
});


