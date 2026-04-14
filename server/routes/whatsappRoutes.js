import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import requireAdmin from '../middlewares/requireAdmin.js';
import { getConnectionStatus, getQRDataURL } from '../services/whatsappService.js';

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

export default router;
