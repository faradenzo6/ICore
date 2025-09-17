import 'dotenv/config';
// Устанавливаем часовой пояс для приложения
process.env.TZ = 'Asia/Tashkent';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import { router as authRouter } from './modules/auth/routes';
import { router as productsRouter } from './modules/products/routes';
import { router as categoriesRouter } from './modules/categories/routes';
import { router as stockRouter } from './modules/stock/routes';
import { router as salesRouter } from './modules/sales/routes';
import { router as reportsRouter } from './modules/reports/routes';
import { router as uploadRouter } from './modules/upload/routes';
import { router as usersRouter } from './modules/users/routes';
import { authGuard } from './middlewares/auth';
import { prisma } from './lib/prisma';
import { startScheduler } from './lib/scheduler';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const origin = process.env.CORS_ORIGIN || 'http://localhost:5175';
app.use(
  cors({
    origin,
    credentials: true,
  })
);

app.use(morgan('dev'));

// static uploads
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/static/uploads', express.static(uploadDir));

// routes
app.use('/api/auth', authRouter);
app.get('/api/me', authGuard, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, username: true, role: true } });
  return res.json(user);
});
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/stock', stockRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);

// serve web build if present (works in dev/prod)
const webDist = path.resolve(__dirname, '../../web/dist');
console.log('[static] __dirname=', __dirname);
console.log('[static] webDist path=', webDist, 'exists=', fs.existsSync(webDist));
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Внутренняя ошибка сервера' });
});

const port = Number(process.env.API_PORT || 5050);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  
  // Запускаем планировщик задач
  startScheduler();
});


