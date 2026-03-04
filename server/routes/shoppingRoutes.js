import express from 'express';
import { getShoppingItems, addShoppingItem, toggleShoppingItem, updateShoppingItem, deleteShoppingItem, clearBoughtItems } from '../controllers/shoppingController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getShoppingItems);
router.post('/', addShoppingItem);
router.delete('/bought/clear', clearBoughtItems);
router.patch('/:id/toggle', toggleShoppingItem);
router.patch('/:id', updateShoppingItem);
router.delete('/:id', deleteShoppingItem);

export default router;
