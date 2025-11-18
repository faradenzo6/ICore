import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authGuard, requireRole } from '../../middlewares/auth';

export const router = Router();

const createPhoneSchema = z.object({
  imei: z.string().min(1),
  model: z.string().min(1),
  purchasePrice: z.number().nonnegative(),
  condition: z.enum(['new', 'used']),
  salePrice: z.number().nonnegative().optional(),
});

// Создать телефон (поступление на склад)
router.post('/', authGuard, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = createPhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Валидация не пройдена', issues: parsed.error.flatten() });
    }
    const { imei, model, purchasePrice, condition, salePrice } = parsed.data;
    const userId = req.user!.userId;

    const result = await prisma.$transaction(async (tx: any) => {
      // Проверяем, не существует ли уже телефон с таким IMEI
      const existing = await tx.phone.findUnique({ where: { imei } });
      if (existing) {
        throw Object.assign(new Error('Телефон с таким IMEI уже существует'), { status: 422 });
      }

      const phone = await tx.phone.create({
        data: {
          imei,
          model,
          purchasePrice,
          condition,
          salePrice: salePrice || null,
          status: 'in_stock',
        },
      });

      // Создаём запись о поступлении
      await tx.phoneMovement.create({
        data: {
          phoneId: phone.id,
          type: 'IN',
          purchasePrice,
          salePrice: salePrice || null,
          userId,
        },
      });

      return phone;
    });

    res.status(201).json(result);
  } catch (err: any) {
    const status = err?.status && Number.isFinite(err.status) ? Number(err.status) : 500;
    return res.status(status).json({ message: err?.message || 'Ошибка добавления телефона' });
  }
});

// Получить список телефонов
router.get('/', authGuard, async (req, res) => {
  const { status, page = '1', limit = '100' } = req.query as Record<string, string>;
  const where: any = {};
  if (status) {
    where.status = status;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(1000, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    prisma.phone.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.phone.count({ where }),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
});

// Получить телефон по ID
router.get('/:id', authGuard, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Некорректный id' });
  }
  const phone = await prisma.phone.findUnique({
    where: { id },
    include: {
      movements: {
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!phone) {
    return res.status(404).json({ message: 'Телефон не найден' });
  }
  res.json(phone);
});

// Получить историю движений телефонов
router.get('/movements/history', authGuard, async (req, res) => {
  const { from, to, type, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }
  if (type) where.type = type;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    prisma.phoneMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        phone: true,
        user: { select: { username: true } },
      },
      skip,
      take: limitNum,
    }),
    prisma.phoneMovement.count({ where }),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
});

