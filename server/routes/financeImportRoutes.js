import { Router } from 'express';
import { uploadAndParse, processTransactions } from '../controllers/financeImportController.js';

const router = Router();

router.post('/parse', uploadAndParse);
router.post('/process', processTransactions);

export default router;
