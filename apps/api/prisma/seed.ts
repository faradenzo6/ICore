import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';

// Load env from local .env or root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash, role: 'ADMIN' },
    create: { username: 'admin', passwordHash, role: 'ADMIN' },
  });

  const categories = ['Напитки', 'Снэки'];
  const catRecords = await Promise.all(
    categories.map((name) =>
      prisma.category.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const [drinks, snacks] = catRecords;

  // Basic products with placeholder images and real-like SKUs
  await prisma.product.upsert({
    where: { sku: '4601234567890' },
    update: {},
    create: {
      name: 'Coca-Cola 0.5L',
      sku: '4601234567890',
      categoryId: drinks.id,
      price: 12000,
      imageUrl: null,
      stock: 50,
    },
  });

  await prisma.product.upsert({
    where: { sku: '4600987654321' },
    update: {},
    create: {
      name: 'Snickers',
      sku: '4600987654321',
      categoryId: snacks.id,
      price: 10000,
      imageUrl: null,
      stock: 40,
    },
  });

  // Аксессуары и мышки удалены из демо-данных

  console.log('Seed completed. Admin username:', admin.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


