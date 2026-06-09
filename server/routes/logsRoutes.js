import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAllLogs,
  getLogsSummary,
  getMyLogs,
  deleteOldLogs,
  deleteAllLogs,
  toggleLogging,
  getLoggingStatus,
  receiveDevicePing,
  getUserActivitySummary,
  getVisitors,
  getVisitorJourney,
  getLiveVisitors,
  receiveBehavior,
} from '../controllers/logsController.js';

const router = express.Router();

// ★ Device ping — client sends device info once, stored in server cache
router.post('/device-ping', receiveDevicePing);

// ★ Behavior beacon — sent via navigator.sendBeacon on page leave (public, no auth)
router.post('/behavior', receiveBehavior);

// ★ Toggle + Status — שליטה על הלוגים
router.post('/admin/toggle', requireAuth, requireAdmin, toggleLogging);
router.get('/admin/status', requireAuth, requireAdmin, getLoggingStatus);

// Admin routes
router.get('/admin/all', requireAuth, requireAdmin, getAllLogs);
router.get('/admin/summary', requireAuth, requireAdmin, getLogsSummary);
router.get('/admin/user-activity', requireAuth, requireAdmin, getUserActivitySummary);
router.get('/admin/visitors', requireAuth, requireAdmin, getVisitors);
router.get('/admin/journey', requireAuth, requireAdmin, getVisitorJourney);
router.get('/admin/live', requireAuth, requireAdmin, getLiveVisitors);

// User routes
router.get('/my-logs', requireAuth, getMyLogs);

// Cleanup
router.delete('/admin/cleanup', requireAuth, requireAdmin, deleteOldLogs);
router.delete('/admin/delete-all', requireAuth, requireAdmin, deleteAllLogs);

export default router;