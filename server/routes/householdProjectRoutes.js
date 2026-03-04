import express from 'express';
import {
  getHouseholdProjects,
  getHouseholdProject,
  createHouseholdProject,
  updateHouseholdProject,
  deleteHouseholdProject,
  addFund,
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
} from '../controllers/householdProjectController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getHouseholdProjects);
router.get('/:id', getHouseholdProject);
router.post('/', createHouseholdProject);
router.patch('/:id', updateHouseholdProject);
router.delete('/:id', deleteHouseholdProject);

// Fund operations (goal projects)
router.post('/:id/funds', addFund);

// Task operations (task projects)
router.post('/:id/tasks', addProjectTask);
router.patch('/:id/tasks/:taskId/toggle', toggleProjectTask);
router.delete('/:id/tasks/:taskId', deleteProjectTask);

export default router;
