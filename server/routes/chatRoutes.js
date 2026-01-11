import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendMessageToClient, getConversations } from '../controllers/chatController.js';
import { handleIncomingEmail } from '../controllers/webhookController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// נתיב השמירה בקליינט
const UPLOADS_DIR = path.join(__dirname, '../../client/public/uploads');

// וודא שהתיקייה קיימת
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// הגדרת Multer לשמירה בדיסק (במקום בזיכרון)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // שם קובץ ייחודי ונקי
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const cleanName = file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix + '-' + cleanName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // מגבלה של 50MB (בבייטים)
});
const router = express.Router();

router.get('/conversations', getConversations);

// שליחת הודעה + העלאת קובץ
router.post('/send', upload.any(), (req, res, next) => {
    // אם הועלה קובץ, נוסיף את ה-URL שלו ל-body כדי שהקונטרולר יכיר אותו
    if (req.files && req.files.length > 0) {
        const file = req.files[0];
        req.body.fileUrl = `/uploads/${file.filename}`; // ה-URL לקליינט
    }
    next();
}, sendMessageToClient);

router.post('/webhook', upload.any(), handleIncomingEmail);

import { Message } from '../models/Message.js';
router.get('/:ticketId', async (req, res) => {
    try {
        const messages = await Message.find({ ticketId: req.params.ticketId }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;