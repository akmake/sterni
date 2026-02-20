import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  changeUserPassword,
  deleteUser,
  changeUserRole
} from '../controllers/adminController.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireAdmin from '../middlewares/requireAdmin.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// --- User management ---
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/password', changeUserPassword);
router.patch('/users/:id/role', changeUserRole);
router.delete('/users/:id', deleteUser);

export default router;
