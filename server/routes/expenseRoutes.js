import express from 'express';
import { getExpenses, addExpense, updateExpense, deleteExpense, getExpenseSummary } from '../controllers/expenseController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getExpenses);
router.get('/summary', getExpenseSummary);
router.post('/', addExpense);
router.patch('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
