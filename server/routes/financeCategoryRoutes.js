import { Router } from 'express';
import {
  getCategories, createCategory, deleteCategory, syncCategories,
  getRules, createRule, deleteRule, applyRules
} from '../controllers/financeCategoryController.js';

const router = Router();

router.get('/', getCategories);
router.post('/', createCategory);
router.delete('/:id', deleteCategory);
router.post('/sync', syncCategories);

router.get('/rules', getRules);
router.post('/rules', createRule);
router.delete('/rules/:id', deleteRule);
router.post('/rules/apply', applyRules);

export default router;
