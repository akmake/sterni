import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getGroupFinancialSummary,
  getPaymentsForGroup,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  deleteAttachment,
  confirmPayment,
  rejectPayment,
  getBillingProfile,
  updateBillingProfile,
  getAllGroupsFinancialReport,
} from '../controllers/Paymentcontroller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// --- Multer config for payment attachments ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/payments');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `payment-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך. ניתן להעלות תמונות, PDF, Word ו-Excel.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// ═══════════════════════════════════════════════
// דוח כולל (כל הקבוצות)
// ═══════════════════════════════════════════════
router.get('/report', getAllGroupsFinancialReport);

// ═══════════════════════════════════════════════
// סיכום כספי לקבוצה
// ═══════════════════════════════════════════════
router.get('/groups/:groupId/summary', getGroupFinancialSummary);

// ═══════════════════════════════════════════════
// פרופיל חיוב
// ═══════════════════════════════════════════════
router.get('/groups/:groupId/billing', getBillingProfile);
router.put('/groups/:groupId/billing', updateBillingProfile);

// ═══════════════════════════════════════════════
// CRUD תשלומים
// ═══════════════════════════════════════════════
router.get('/groups/:groupId/payments', getPaymentsForGroup);
router.post('/groups/:groupId/payments', upload.array('attachments', 5), createPayment);
router.get('/payments/:paymentId', getPayment);
router.patch('/payments/:paymentId', upload.array('attachments', 5), updatePayment);
router.delete('/payments/:paymentId', deletePayment);

// --- פעולות מיוחדות ---
router.patch('/payments/:paymentId/confirm', confirmPayment);
router.patch('/payments/:paymentId/reject', rejectPayment);
router.delete('/payments/:paymentId/attachments/:attachmentId', deleteAttachment);

export default router;