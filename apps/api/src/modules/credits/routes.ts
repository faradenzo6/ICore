import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

// Получить все кредиты (продажи в кредит)
router.get('/', authGuard, async (req, res) => {
  try {
    const credits = await prisma.sale.findMany({
      where: {
        paymentMethod: 'credit',
      },
      include: {
        phoneSales: {
          include: {
            phone: true,
          },
        },
        creditPayments: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Вычисляем оплаченную сумму и остаток для каждого кредита
    const creditsWithBalance = credits.map((credit) => {
      const totalPaid =
        Number(credit.initialPayment || 0) +
        credit.creditPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(credit.total) - totalPaid;
      const phoneSale = credit.phoneSales[0];

      return {
        id: credit.id,
        saleId: credit.id,
        phone: phoneSale?.phone || null,
        customerFirstName: credit.customerFirstName,
        customerLastName: credit.customerLastName,
        salePrice: phoneSale ? Number(phoneSale.salePrice) : Number(credit.total),
        purchasePrice: phoneSale ? Number(phoneSale.purchasePrice) : 0,
        total: Number(credit.total),
        initialPayment: Number(credit.initialPayment || 0),
        monthlyPayment: Number(credit.monthlyPayment || 0),
        creditMonths: credit.creditMonths || 0,
        totalPaid,
        remaining,
        createdAt: credit.createdAt,
        payments: credit.creditPayments,
        soldBy: credit.user?.username,
      };
    });

    res.json(creditsWithBalance);
  } catch (error: any) {
    console.error('[credits] Ошибка получения кредитов:', error);
    res.status(500).json({ message: error?.message || 'Ошибка получения кредитов' });
  }
});

// Внести платёж по кредиту
const paymentSchema = z.object({
  saleId: z.number().int(),
  amount: z.number().positive(),
  note: z.string().optional(),
});

router.post('/payment', authGuard, requireRole('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Валидация не пройдена', issues: parsed.error.flatten() });
    }
    const { saleId, amount, note } = parsed.data;
    const userId = req.user!.userId;

    const result = await prisma.$transaction(async (tx: any) => {
      // Проверяем, что продажа существует и это кредит
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          creditPayments: true,
        },
      });

      if (!sale) {
        throw Object.assign(new Error('Продажа не найдена'), { status: 404 });
      }

      if (sale.paymentMethod !== 'credit') {
        throw Object.assign(new Error('Это не кредитная продажа'), { status: 422 });
      }

      // Вычисляем уже оплаченную сумму
      const totalPaid =
        Number(sale.initialPayment || 0) +
        sale.creditPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // Проверяем, не превышает ли платёж остаток
      if (totalPaid + amount > Number(sale.total)) {
        throw Object.assign(
          new Error(`Сумма платежа превышает остаток. Остаток: ${Number(sale.total) - totalPaid}`),
          { status: 422 }
        );
      }

      // Создаём запись о платеже
      const payment = await tx.creditPayment.create({
        data: {
          saleId,
          amount,
          note: note || null,
          userId,
        },
      });

      return payment;
    });

    res.status(201).json(result);
  } catch (err: any) {
    const status = err?.status && Number.isFinite(err.status) ? Number(err.status) : 500;
    return res.status(status).json({ message: err?.message || 'Ошибка внесения платежа' });
  }
});

// Получить информацию о конкретном кредите
router.get('/:id', authGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Некорректный id' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        phoneSales: {
          include: {
            phone: true,
          },
        },
        creditPayments: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!sale || sale.paymentMethod !== 'credit') {
      return res.status(404).json({ message: 'Кредит не найден' });
    }

    const totalPaid =
      Number(sale.initialPayment || 0) +
      sale.creditPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(sale.total) - totalPaid;
    const phoneSale = sale.phoneSales[0];

    res.json({
      id: sale.id,
      phone: phoneSale?.phone || null,
      customerFirstName: sale.customerFirstName,
      customerLastName: sale.customerLastName,
      salePrice: phoneSale ? Number(phoneSale.salePrice) : Number(sale.total),
      purchasePrice: phoneSale ? Number(phoneSale.purchasePrice) : 0,
      total: Number(sale.total),
      initialPayment: Number(sale.initialPayment || 0),
      monthlyPayment: Number(sale.monthlyPayment || 0),
      creditMonths: sale.creditMonths || 0,
      totalPaid,
      remaining,
      createdAt: sale.createdAt,
      payments: sale.creditPayments,
      soldBy: sale.user?.username,
    });
  } catch (error: any) {
    console.error('[credits] Ошибка получения кредита:', error);
    res.status(500).json({ message: error?.message || 'Ошибка получения кредита' });
  }
});

