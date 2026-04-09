import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAllSoftware, getSoftware, uploadSoftware, updateSoftware,
  deleteSoftware, downloadSoftware,
  getCategories, createCategory, deleteCategory,
} from '../controllers/softwareController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Multer — שמירה פיזית לדיסק, עד 2GB ─────────────────────────────────────
const ALLOWED_EXT = /exe|msi|msix|appx|dmg|pkg|deb|rpm|zip|7z|rar|tar|gz|bz2|xz|iso|img|apk|jar|bat|sh|ps1|inf|cab/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/software/')),
  filename: (req, file, cb) => {
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(original);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(original).slice(1);
    ALLOWED_EXT.test(ext) ? cb(null, true) : cb(new Error(`סוג קובץ לא נתמך: .${ext}`), false);
  },
});

// ─── Categories (לפני /:id כדי לא להתנגש) ────────────────────────────────────
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:name', deleteCategory);

// ─── Items ────────────────────────────────────────────────────────────────────
router.get('/', getAllSoftware);
router.get('/:id', getSoftware);
router.get('/:id/download', downloadSoftware);
router.post('/', upload.single('file'), uploadSoftware);
router.patch('/:id', updateSoftware);
router.delete('/:id', deleteSoftware);

export default router;
