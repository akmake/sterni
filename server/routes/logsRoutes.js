import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllLogs,
  getLogsSummary,
  getMyLogs,
  deleteOldLogs,
} from '../controllers/logsController.js';

const router = express.Router();

// Admin routes - view all logs
router.get('/admin/all', requireAuth, requireAdmin, getAllLogs);
router.get('/admin/summary', requireAuth, requireAdmin, getLogsSummary);

// User routes - view own logs
router.get('/my-logs', requireAuth, getMyLogs);

// Admin routes - cleanup
router.delete('/admin/cleanup', requireAuth, requireAdmin, deleteOldLogs);

export default router;
