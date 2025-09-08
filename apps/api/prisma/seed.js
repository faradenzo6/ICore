"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// Load env from local .env or root .env
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
const prisma = new client_1.PrismaClient();
async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt_1.default.hash(adminPassword, 10);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { passwordHash, role: 'ADMIN' },
        create: { email: adminEmail, passwordHash, role: 'ADMIN' },
    });
    const categories = ['Напитки', 'Снэки', 'Аксессуары'];
    const catRecords = await Promise.all(categories.map((name) => prisma.category.upsert({ where: { name }, update: {}, create: { name } })));
    const [drinks, snacks, accessories] = catRecords;
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
    await prisma.product.upsert({
        where: { sku: '2000012345678' },
        update: {},
        create: {
            name: 'Mousepad ARENA',
            sku: '2000012345678',
            categoryId: accessories.id,
            price: 45000,
            imageUrl: null,
            stock: 20,
        },
    });
    console.log('Seed completed. Admin:', admin.email);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
