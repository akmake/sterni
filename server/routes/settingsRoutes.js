import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth as protect, requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

// --- חשבונות מייל / סיסמאות / ניתוב = מנהל בלבד (חושף סודות מערכת) ---
router.get('/accounts', requireAdmin, settingsController.getAccounts);
router.get('/accounts/:id/password', requireAdmin, settingsController.getAccountPassword);
router.post('/account', requireAdmin, settingsController.saveEmailAccount);
router.delete('/account/:id', requireAdmin, settingsController.deleteAccount);
router.post('/test-connection', requireAdmin, settingsController.testConnection);

router.get('/config', requireAdmin, settingsController.getConfig);
router.post('/routing', requireAdmin, settingsController.updateRouting);
router.get('/quote-template', settingsController.getQuoteTemplate);
router.post('/quote-template', settingsController.updateQuoteTemplate);
router.get('/quote-templates', settingsController.getQuoteTemplates);
router.post('/quote-templates', settingsController.createQuoteTemplate);
router.put('/quote-templates/:id', settingsController.updateQuoteTemplateById);
router.delete('/quote-templates/:id', settingsController.deleteQuoteTemplateById);
router.post('/quote-templates/:id/activate', settingsController.activateQuoteTemplateById);

export default router;
