import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authGuard, requireRole } from '../../middlewares/auth';

const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Недопустимый тип файла'));
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } });

export const router = Router();

router.post('/', authGuard, requireRole('ADMIN'), upload.single('file'), (req, res) => {
  const filename = (req.file as Express.Multer.File).filename;
  const url = `/static/uploads/${filename}`;
  res.json({ url });
});


