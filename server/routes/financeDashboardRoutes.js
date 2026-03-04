import { Router } from 'express';
import { getDashboardData } from '../controllers/financeDashboardController.js';

const router = Router();

router.get('/', getDashboardData);

export default router;
