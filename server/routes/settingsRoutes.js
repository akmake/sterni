import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
// התיקון: הוספנו s לתיקייה, והשתמשנו ב-requireAuth
import { requireAuth as protect } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// כל הנתיבים כאן צריכים להיות מוגנים
router.use(protect); 

// ניהול חשבונות (הבנק)
router.get('/accounts', settingsController.getAccounts);
router.post('/account', settingsController.saveEmailAccount);
router.post('/test-connection', settingsController.testConnection);

// ניהול ניתוב (מי עושה מה)
router.get('/config', settingsController.getConfig);
router.post('/routing', settingsController.updateRouting);

export default router;