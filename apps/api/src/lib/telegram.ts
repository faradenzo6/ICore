import { fetch, dispatcher } from './http';
import { prisma } from './prisma';

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '8475679792:AAHVGHAfx3hIoSPOPMAqcJSnkOlbHpzgJzs';
    const chatId = process.env.TELEGRAM_CHAT_ID || '-4614810639';
    const httpsProxy = process.env.HTTPS_PROXY;
    
    if (!token || !chatId) {
      console.log('[telegram] Токен или chat_id не настроены');
      return;
    }

    console.log('[telegram] Отправляем сообщение');
    if (httpsProxy) {
      console.log('[telegram] Используется прокси:', httpsProxy);
    } else {
      console.log('[telegram] Прокси не настроен, используется прямое подключение');
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
      dispatcher,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[telegram] Ошибка отправки сообщения:', response.status, response.statusText, errorText);
    } else {
      console.log('[telegram] Сообщение успешно отправлено');
    }
  } catch (error) {
    console.error('[telegram] Ошибка отправки уведомления:', error);
  }
}

// Уведомление о поступлении товара
export async function notifyStockIn(productId: number, quantity: number, unitPrice: number | undefined, userId: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true }
    });

    if (!product) {
      console.error('[telegram] Товар не найден для уведомления о поступлении:', productId);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });

    const now = new Date().toLocaleString('ru-RU');
    const totalCost = unitPrice ? unitPrice * quantity : 0;
    
    let text = `📦 <b>ПОСТУПЛЕНИЕ ТОВАРА</b>\n` +
      `🛍️ Товар: <b>${product.name}</b>\n` +
      `📊 Количество: <b>${quantity}</b>\n` +
      `💰 Цена закупки: <b>${unitPrice ? unitPrice.toLocaleString('ru-RU') + ' USD' : 'не указана'}</b>\n` +
      `💵 Общая стоимость: <b>${totalCost.toLocaleString('ru-RU')} USD</b>\n` +
      `📈 Новый остаток: <b>${product.stock}</b>\n` +
      `📅 Дата поступления: <b>${now}</b>\n` +
      `👤 Кто добавил: <b>${user?.username ?? ''}</b>\n`;

    if (product.category) {
      text += `🏷️ Категория: <b>${product.category.name}</b>\n`;
    }

    await sendTelegramMessage(text);
  } catch (error) {
    console.error('[telegram] Ошибка уведомления о поступлении:', error);
  }
}

// Уведомление о списании товара
export async function notifyStockOut(productId: number, quantity: number, note: string | undefined, userId: number) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true }
    });

    if (!product) {
      console.error('[telegram] Товар не найден для уведомления о списании:', productId);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });

    const now = new Date().toLocaleString('ru-RU');
    
    let text = `📤 <b>СПИСАНИЕ ТОВАРА</b>\n` +
      `🛍️ Товар: <b>${product.name}</b>\n` +
      `📊 Количество: <b>${quantity}</b>\n` +
      `📈 Новый остаток: <b>${product.stock}</b>\n` +
      `📅 Дата списания: <b>${now}</b>\n` +
      `👤 Кто списал: <b>${user?.username ?? ''}</b>\n`;

    if (note) {
      text += `📝 Причина: <b>${note}</b>\n`;
    }

    if (product.category) {
      text += `🏷️ Категория: <b>${product.category.name}</b>\n`;
    }

    await sendTelegramMessage(text);
  } catch (error) {
    console.error('[telegram] Ошибка уведомления о списании:', error);
  }
}

// Ежемесячный отчёт
export async function sendMonthlyReport() {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    console.log('[telegram] Генерируем ежемесячный отчёт за:', lastMonth.toLocaleDateString('ru-RU'), '-', lastMonthEnd.toLocaleDateString('ru-RU'));

    // Получаем все продажи за прошлый месяц
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: lastMonth,
          lte: lastMonthEnd
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (sales.length === 0) {
      await sendTelegramMessage(`📊 <b>ЕЖЕМЕСЯЧНЫЙ ОТЧЁТ</b>\n\n📅 Период: <b>${lastMonth.toLocaleDateString('ru-RU')} - ${lastMonthEnd.toLocaleDateString('ru-RU')}</b>\n\n❌ Продаж за этот период не было.`);
      return;
    }

    // Группируем товары
    const productStats = new Map<string, {
      name: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      profit: number;
    }>();

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let totalSales = sales.length;

    for (const sale of sales) {
      // Подсчёт по способам оплаты
      if (sale.paymentMethod === 'cash') {
        cashRevenue += Number(sale.total);
      } else if (sale.paymentMethod === 'card') {
        cardRevenue += Number(sale.total);
      }

      totalRevenue += Number(sale.total);

      for (const item of sale.items) {
        const product = item.product;
        const key = product.name;
        const quantity = item.quantity;
        const unitPrice = Number(item.unitPrice);
        const unitCost = Number(item.unitCost || product.costPrice || 0);
        const revenue = quantity * unitPrice;
        const cost = quantity * unitCost;
        const profit = revenue - cost;

        if (productStats.has(key)) {
          const existing = productStats.get(key)!;
          existing.totalQuantity += quantity;
          existing.totalRevenue += revenue;
          existing.totalCost += cost;
          existing.profit += profit;
        } else {
          productStats.set(key, {
            name: product.name,
            totalQuantity: quantity,
            totalRevenue: revenue,
            totalCost: cost,
            profit
          });
        }

        totalCost += cost;
        totalProfit += profit;
      }
    }

    // Формируем отчёт
    let report = `📊 <b>ЕЖЕМЕСЯЧНЫЙ ОТЧЁТ</b>\n\n`;
    report += `📅 Период: <b>${lastMonth.toLocaleDateString('ru-RU')} - ${lastMonthEnd.toLocaleDateString('ru-RU')}</b>\n\n`;

    // Детализация по товарам
    report += `📦 <b>ДЕТАЛИЗАЦИЯ ПО ТОВАРАМ:</b>\n`;
    const sortedProducts = Array.from(productStats.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    for (const product of sortedProducts) {
      report += `\n🛍️ <b>${product.name}</b>\n`;
      report += `   📊 Продано: <b>${product.totalQuantity} шт.</b>\n`;
      report += `   💰 Выручка: <b>${product.totalRevenue.toLocaleString('ru-RU')} USD</b>\n`;
      report += `   💸 Себестоимость: <b>${product.totalCost.toLocaleString('ru-RU')} USD</b>\n`;
      report += `   💵 Прибыль: <b>${product.profit.toLocaleString('ru-RU')} USD</b>\n`;
    }

    // Сводка
    report += `\n\n📈 <b>СВОДКА:</b>\n`;
    report += `💰 Общая выручка: <b>${totalRevenue.toLocaleString('ru-RU')} USD</b>\n`;
    report += `💸 Общая себестоимость: <b>${totalCost.toLocaleString('ru-RU')} USD</b>\n`;
    report += `💵 Чистая прибыль: <b>${totalProfit.toLocaleString('ru-RU')} USD</b>\n`;
    report += `📊 Количество продаж: <b>${totalSales}</b>\n\n`;

    // По способам оплаты
    report += `💳 <b>ПО СПОСОБАМ ОПЛАТЫ:</b>\n`;
    report += `💵 Наличные: <b>${cashRevenue.toLocaleString('ru-RU')} USD</b>\n`;
    report += `💳 Карта: <b>${cardRevenue.toLocaleString('ru-RU')} USD</b>\n`;

    // Отправляем отчёт (разбиваем на части если слишком длинный)
    const maxLength = 4000; // Telegram лимит
    if (report.length > maxLength) {
      const parts = [];
      let currentPart = '';
      const lines = report.split('\n');
      
      for (const line of lines) {
        if (currentPart.length + line.length + 1 > maxLength) {
          parts.push(currentPart);
          currentPart = line + '\n';
        } else {
          currentPart += line + '\n';
        }
      }
      if (currentPart) {
        parts.push(currentPart);
      }
      
      for (let i = 0; i < parts.length; i++) {
        await sendTelegramMessage(parts[i]);
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка между сообщениями
        }
      }
    } else {
      await sendTelegramMessage(report);
    }

    console.log('[telegram] Ежемесячный отчёт отправлен');
  } catch (error) {
    console.error('[telegram] Ошибка генерации ежемесячного отчёта:', error);
  }
}

export { sendTelegramMessage };
