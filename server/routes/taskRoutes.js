import express from 'express';
import { getTasks, createTask, updateTaskStatus, deleteTask } from '../controllers/taskController.js';
// 👇 הייבוא הנכון מהקובץ ששלחת לי
import requireAuth from '../middlewares/requireAuth.js'; 

const router = express.Router();

// שימוש בהגנה האמיתית של הפרויקט שלך (בודקת קוקיז)
router.use(requireAuth);

router.get('/', getTasks);
router.post('/', createTask);
router.patch('/:id', updateTaskStatus);
router.delete('/:id', deleteTask);

export default router;