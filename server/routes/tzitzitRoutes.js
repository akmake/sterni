import { Router } from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getDashboard,
  getSupplierHistory,
} from '../controllers/tzitzitController.js';

const router = Router();

// כל המסלולים דורשים הרשאת מנהל
router.use(requireAdmin);

// ─── דשבורד ───
router.get('/dashboard', getDashboard);

// ─── ספקים ───
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.patch('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// ─── הזמנות עבודה ───
router.get('/orders', getWorkOrders);
router.post('/orders', createWorkOrder);
router.patch('/orders/:id', updateWorkOrder);
router.delete('/orders/:id', deleteWorkOrder);

// ─── תשלומים ───
router.get('/payments', getPayments);
router.post('/payments', createPayment);
router.patch('/payments/:id', updatePayment);
router.delete('/payments/:id', deletePayment);

// ─── היסטוריה לספק בודד ───
router.get('/history/:supplierId', getSupplierHistory);

export default router;
