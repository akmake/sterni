import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import requireAdmin from '../middlewares/requireAdmin.js';
import { getConnectionStatus, getQRDataURL, getDiagnostics } from '../services/whatsappService.js';
import { getEmailListenerStatus } from '../services/emailListener.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/whatsapp/status — סטטוס החיבור
router.get('/status', (req, res) => {
    res.json(getConnectionStatus());
});

// GET /api/whatsapp/qr — QR code כ-data URL (null אם מחובר)
router.get('/qr', (req, res) => {
    const status = getConnectionStatus();
    const qr = getQRDataURL();
    res.json({ status: status.state, qr });
});

// GET /api/whatsapp/diagnostics — לוג מוניטורינג מפורט
// מחזיר: סטטוס WA + IMAP, מונים, 200 אירועים אחרונים (חדש → ישן)
router.get('/diagnostics', (req, res) => {
    const diag = getDiagnostics();
    const email = getEmailListenerStatus();
    res.json({ ...diag, email });
});

export default router;
