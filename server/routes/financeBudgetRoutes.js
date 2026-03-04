import { Router } from 'express';
import {
  getBudget, upsertBudget, deleteBudget,
  copyBudget, getBudgetSummary
} from '../controllers/financeBudgetController.js';

const router = Router();

router.get('/', getBudget);
router.post('/', upsertBudget);
router.delete('/:id', deleteBudget);
router.post('/copy', copyBudget);
router.get('/summary', getBudgetSummary);

export default router;
