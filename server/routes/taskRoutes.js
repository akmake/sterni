import express from 'express';
import { getTasks, createTask, updateTaskStatus, deleteTask, convertTaskToProject, markTasksSeen } from '../controllers/taskController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// שימוש בהגנה האמיתית של הפרויקט שלך (בודקת קוקיז)
router.use(requireAuth);

router.get('/', getTasks);
router.post('/', createTask);
router.post('/seen', markTasksSeen);
router.patch('/:id', updateTaskStatus);
router.delete('/:id', deleteTask);
router.post('/:id/convert', convertTaskToProject);

export default router;