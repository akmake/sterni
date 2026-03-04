import { Router } from 'express';
import {
  getTransactions, addTransaction, updateTransaction,
  deleteTransaction, deleteAllTransactions, bulkUpdateMerchant
} from '../controllers/financeTransactionController.js';

const router = Router();

router.get('/', getTransactions);
router.post('/', addTransaction);
router.post('/merchant-bulk', bulkUpdateMerchant);
router.put('/:id', updateTransaction);
router.delete('/all', deleteAllTransactions);
router.delete('/:id', deleteTransaction);

export default router;
