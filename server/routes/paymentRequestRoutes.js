import express from 'express';
import {
  savePaymentRequest,
  getPaymentRequests,
  getPaymentRequest,
  deletePaymentRequest,
  updatePaymentRequestStatus,
  sendPaymentRequest
} from '../controllers/PaymentRequestController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// --- Main routes ---
router.route('/')
  .get(getPaymentRequests)
  .post(savePaymentRequest);

router.route('/:id')
  .get(getPaymentRequest)
  .patch(savePaymentRequest)
  .delete(deletePaymentRequest);

router.patch('/:id/status', updatePaymentRequestStatus);

router.post('/:id/send', sendPaymentRequest);

export default router;
