import { Router } from 'express';
import {
  getRecurringTransactions, addRecurringTransaction,
  updateRecurringTransaction, deleteRecurringTransaction,
  toggleRecurring, detectPatterns, getCashflowForecast
} from '../controllers/financeRecurringController.js';

const router = Router();

router.get('/', getRecurringTransactions);
router.post('/', addRecurringTransaction);
router.put('/:id', updateRecurringTransaction);
router.delete('/:id', deleteRecurringTransaction);
router.patch('/:id/toggle', toggleRecurring);
router.get('/detect', detectPatterns);
router.get('/cashflow', getCashflowForecast);

export default router;
