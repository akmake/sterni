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

export default router;