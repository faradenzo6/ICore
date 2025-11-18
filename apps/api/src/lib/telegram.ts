import { fetch, dispatcher } from './http';
import { prisma } from './prisma';

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '8539140642:AAHoTNdn-y4I2sxswotPLNCMWlckwNPHEp8';
    const chatId = process.env.TELEGRAM_CHAT_ID || '-1003416454746';
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
    
    let text = `📦 <b>ПОСТУПЛЕНИЕ ТОВАРА</b>\n\n` +
      `🛍️ <b>Товар:</b> ${product.name}\n` +
      `📊 <b>Количество:</b> ${quantity} шт.\n` +
      `💰 <b>Цена закупки:</b> ${unitPrice ? unitPrice.toLocaleString('ru-RU') + ' USD' : 'не указана'}\n` +
      `💵 <b>Общая стоимость:</b> ${totalCost.toLocaleString('ru-RU')} USD\n` +
      `📈 <b>Новый остаток:</b> ${product.stock} шт.\n` +
      `📅 <b>Дата:</b> ${now}\n` +
      `👤 <b>Оператор:</b> ${user?.username ?? 'неизвестно'}\n`;

    if (product.category) {
      text += `🏷️ <b>Категория:</b> ${product.category.name}\n`;
    }
    
    if (product.sku) {
      text += `🔖 <b>SKU:</b> ${product.sku}\n`;
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
    
    let text = `📤 <b>СПИСАНИЕ ТОВАРА</b>\n\n` +
      `🛍️ <b>Товар:</b> ${product.name}\n` +
      `📊 <b>Количество:</b> ${quantity} шт.\n` +
      `📈 <b>Новый остаток:</b> ${product.stock} шт.\n` +
      `📅 <b>Дата:</b> ${now}\n` +
      `👤 <b>Оператор:</b> ${user?.username ?? 'неизвестно'}\n`;

    if (note) {
      text += `📝 <b>Причина:</b> ${note}\n`;
    }

    if (product.category) {
      text += `🏷️ <b>Категория:</b> ${product.category.name}\n`;
    }
    
    if (product.sku) {
      text += `🔖 <b>SKU:</b> ${product.sku}\n`;
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

// Уведомление о продаже телефона
export async function notifyPhoneSale(saleId: number, userId: number) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        phoneSales: {
          include: {
            phone: true
          }
        },
        user: {
          select: { username: true }
        }
      }
    });

    if (!sale || !sale.phoneSales.length) {
      console.error('[telegram] Продажа телефона не найдена:', saleId);
      return;
    }

    const phoneSale = sale.phoneSales[0];
    const phone = phoneSale.phone;
    const now = new Date().toLocaleString('ru-RU');
    const profit = Number(phoneSale.salePrice) - Number(phone.purchasePrice || 0);
    
    let text = `📱 <b>ПРОДАЖА ТЕЛЕФОНА</b>\n\n` +
      `📱 <b>Модель:</b> ${phone.model}\n` +
      `💵 <b>Цена продажи:</b> ${Number(phoneSale.salePrice).toLocaleString('ru-RU')} USD\n` +
      `💰 <b>Цена закупки:</b> ${Number(phone.purchasePrice || 0).toLocaleString('ru-RU')} USD\n` +
      `💵 <b>Прибыль:</b> ${profit.toLocaleString('ru-RU')} USD\n` +
      `💳 <b>Способ оплаты:</b> ${sale.paymentMethod === 'cash' ? 'Наличные' : sale.paymentMethod === 'card' ? 'Карта' : 'Кредит'}\n`;

    if (sale.customerFirstName || sale.customerLastName) {
      text += `👤 <b>Покупатель:</b> ${[sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ')}\n`;
    }

    if (sale.paymentMethod === 'credit') {
      text += `\n💳 <b>КРЕДИТНАЯ ПРОДАЖА</b>\n` +
        `💵 <b>Первоначальный взнос:</b> ${Number(sale.initialPayment || 0).toLocaleString('ru-RU')} USD\n` +
        `📅 <b>Срок кредита:</b> ${sale.creditMonths || 0} мес.\n` +
        `💰 <b>Ежемесячный платёж:</b> ${Number(sale.monthlyPayment || 0).toLocaleString('ru-RU')} USD\n`;
    }

    text += `\n📅 <b>Дата продажи:</b> ${now}\n` +
      `👤 <b>Продавец:</b> ${sale.user?.username ?? 'неизвестно'}\n`;

    if (phone.imei) {
      text += `🔢 <b>IMEI:</b> ${phone.imei}\n`;
    }

    await sendTelegramMessage(text);
  } catch (error) {
    console.error('[telegram] Ошибка уведомления о продаже телефона:', error);
  }
}

// Уведомление о кредитном платеже
export async function notifyCreditPayment(saleId: number, amount: number, userId: number, note?: string) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        phoneSales: {
          include: {
            phone: true
          }
        },
        creditPayments: true,
        user: {
          select: { username: true }
        }
      }
    });

    if (!sale) {
      console.error('[telegram] Продажа не найдена для уведомления о платеже:', saleId);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    });

    const totalPaid = Number(sale.initialPayment || 0) +
      sale.creditPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const remaining = Number(sale.total) - totalPaid;
    const now = new Date().toLocaleString('ru-RU');

    let text = `💳 <b>КРЕДИТНЫЙ ПЛАТЁЖ</b>\n\n` +
      `💰 <b>Сумма платежа:</b> ${amount.toLocaleString('ru-RU')} USD\n` +
      `💵 <b>Всего оплачено:</b> ${totalPaid.toLocaleString('ru-RU')} USD\n` +
      `📊 <b>Остаток долга:</b> ${remaining.toLocaleString('ru-RU')} USD\n` +
      `💵 <b>Общая сумма кредита:</b> ${Number(sale.total).toLocaleString('ru-RU')} USD\n`;

    if (sale.phoneSales.length > 0) {
      const phone = sale.phoneSales[0].phone;
      text += `\n📱 <b>Телефон:</b> ${phone.model}\n`;
    }

    if (sale.customerFirstName || sale.customerLastName) {
      text += `👤 <b>Покупатель:</b> ${[sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ')}\n`;
    }

    if (note) {
      text += `📝 <b>Примечание:</b> ${note}\n`;
    }

    text += `\n📅 <b>Дата платежа:</b> ${now}\n` +
      `👤 <b>Принял:</b> ${user?.username ?? 'неизвестно'}\n`;

    await sendTelegramMessage(text);
  } catch (error) {
    console.error('[telegram] Ошибка уведомления о кредитном платеже:', error);
  }
}

export { sendTelegramMessage };
