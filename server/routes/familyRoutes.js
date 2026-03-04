import express from 'express';
import { createFamily, joinFamily, getMyFamily, leaveFamily, removeMember, addCategory, removeCategory, getCategories } from '../controllers/familyController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/my', getMyFamily);
router.post('/create', createFamily);
router.post('/join', joinFamily);
router.post('/leave', leaveFamily);
router.delete('/members/:memberId', removeMember);

// Category management
router.get('/categories/:type', getCategories);
router.post('/categories/:type', addCategory);
router.delete('/categories/:type/:categoryId', removeCategory);

export default router;
