import { Router } from 'express';
import {
  getFinancialAnalytics, getInsights, getRecommendations
} from '../controllers/financeAnalyticsController.js';

const router = Router();

router.get('/', getFinancialAnalytics);
router.get('/insights', getInsights);
router.get('/recommendations', getRecommendations);

export default router;
