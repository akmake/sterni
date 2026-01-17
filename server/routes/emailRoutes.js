import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Email from '../models/Email.js';
import * as emailController from '../controllers/emailController.js'; // תכף ניצור/נעדכן אותו

const router = express.Router();

// --- הגדרת Multer לשמירה זמנית של ה-PDF ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads/temp'); // תיקייה זמנית

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        // שם קובץ זמני עם חותמת זמן כדי למנוע התנגשויות
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // המרת שם הקובץ ל-ASCII בטוח או שימוש בשם גנרי אם יש בעיות קידוד
        cb(null, uniqueSuffix + '.pdf'); 
    }
});

const upload = multer({ storage: storage });

// --- ראוטים קיימים ---
router.get('/', async (req, res) => {
    try {
        const emails = await Email.find().sort({ receivedAt: -1 });
        res.json(emails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const email = await Email.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(email);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- הראוט החדש שביקשת ---
// מקבל את הקובץ תחת השם 'file' (כפי ששלחת ב-FormData בריאקט)
router.post('/send-attachment', upload.single('file'), emailController.sendAttachmentEmail);

export default router;