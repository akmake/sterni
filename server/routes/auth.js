// server/routes/auth.js

import express from 'express';
import { registerUser, loginUser, logout, refresh, getProfile, updateProfile, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
// router.post('/register', registerUser); // הרשמה עצמית בוטלה – רק מנהל יוצר משתמשים
router.post('/login', loginUser);
router.post('/logout', logout);
router.post('/refresh', refresh);

// Protected routes (require authentication)
router.get('/profile', requireAuth, getProfile);
router.patch('/profile', requireAuth, updateProfile);
router.patch('/change-password', requireAuth, changePassword);

export default router;