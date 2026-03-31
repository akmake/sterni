import express from 'express';
import { registerUser, getUserData, syncUserData, loginUser } from '../controllers/shieorUserController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login',    loginUser);
router.get('/:userId',   getUserData);
router.put('/:userId/sync', syncUserData);

export default router;
