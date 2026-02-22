import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import User from '../models/userModel.js';
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

// מידלוור מותאם אישית – רק משתמש עם tzitzitAccess (כולל מנהלים)
const requireTzitzitAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('tzitzitAccess');
    if (user?.tzitzitAccess) return next();
    return res.status(403).json({ message: 'אין לך הרשאה לדף זה' });
  } catch (err) {
    return res.status(500).json({ message: 'שגיאת הרשאות' });
  }
};

router.use(requireTzitzitAccess);

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
