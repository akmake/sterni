import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth as protect } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

router.use(protect); 

router.get('/accounts', settingsController.getAccounts);
router.post('/account', settingsController.saveEmailAccount);
router.post('/test-connection', settingsController.testConnection);

router.get('/config', settingsController.getConfig);
router.post('/routing', settingsController.updateRouting);
router.get('/quote-template', settingsController.getQuoteTemplate);
router.post('/quote-template', settingsController.updateQuoteTemplate);
router.get('/quote-templates', settingsController.getQuoteTemplates);
router.post('/quote-templates', settingsController.createQuoteTemplate);
router.put('/quote-templates/:id', settingsController.updateQuoteTemplateById);
router.delete('/quote-templates/:id', settingsController.deleteQuoteTemplateById);
router.post('/quote-templates/:id/activate', settingsController.activateQuoteTemplateById);

export default router;
