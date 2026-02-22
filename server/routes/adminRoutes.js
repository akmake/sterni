import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  changeUserPassword,
  deleteUser,
  changeUserRole,
  createUser,
  toggleTzitzitAccess
} from '../controllers/adminController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import requireAdmin from '../middlewares/requireAdmin.js';

const router = express.Router();

// ← כל requests חייב להיות מחובר
router.use(requireAuth);

// --- Get users list (for sharing projects) - auth only ---
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);

// --- Admin-only operations ---
router.use(requireAdmin);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/password', changeUserPassword);
router.patch('/users/:id/role', changeUserRole);
router.patch('/users/:id/tzitzit-access', toggleTzitzitAccess);
router.delete('/users/:id', deleteUser);

export default router;
