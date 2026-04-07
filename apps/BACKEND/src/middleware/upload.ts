import multer from 'multer';
import path from 'path';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});
