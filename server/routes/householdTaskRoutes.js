import express from 'express';
import { getHouseholdTasks, createHouseholdTask, toggleHouseholdTask, updateHouseholdTask, deleteHouseholdTask } from '../controllers/householdTaskController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getHouseholdTasks);
router.post('/', createHouseholdTask);
router.patch('/:id/toggle', toggleHouseholdTask);
router.patch('/:id', updateHouseholdTask);
router.delete('/:id', deleteHouseholdTask);

export default router;
