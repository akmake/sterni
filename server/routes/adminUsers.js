import express from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAllUsers,
  updateUser,
  changeUserPassword,
  changeUserRole,
  deleteUser,
} from '../controllers/adminController.js';

const router = express.Router();

// GET users - ציבורי (לשיתוף פרויקטים)
router.get('/', getAllUsers);

// ניהול users - דורש admin בלבד
router.use(requireAdmin);
router.patch('/:id', updateUser);
router.patch('/:id/password', changeUserPassword);
router.patch('/:id/role', changeUserRole);
router.delete('/:id', deleteUser);

export default router;
