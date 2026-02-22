import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAllMeals,
  getMealById,
  createMeal,
  updateMeal,
  deleteMeal,
} from '../controllers/mealsController.js';

const router = express.Router();

// --- ציבורי - כל אחד רואה את הארוחות (ללא דרישת התחברות) ---
router.get('/', getAllMeals);
router.get('/:id', getMealById);

// --- ניהול ארוחות - רק admin (דורש התחברות וקישור admin) ---
router.post('/', requireAuth, requireAdmin, createMeal);
router.patch('/:id', requireAuth, requireAdmin, updateMeal);
router.delete('/:id', requireAuth, requireAdmin, deleteMeal);

export default router;
