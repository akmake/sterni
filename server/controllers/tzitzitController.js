import Supplier from '../models/Supplier.js';
import WorkOrder from '../models/WorkOrder.js';
import SupplierPayment from '../models/SupplierPayment.js';
import mongoose from 'mongoose';

// ═════════════════════════════════════════════════════
//  ספקים — CRUD
// ═════════════════════════════════════════════════════

// קבלת כל הספקים
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת ספקים', error: err.message });
  }
};

// יצירת ספק חדש
export const createSupplier = async (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    const supplier = await Supplier.create({ name, phone, notes });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה ביצירת ספק', error: err.message });
  }
};

// עדכון ספק
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!supplier) return res.status(404).json({ message: 'ספק לא נמצא' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה בעדכון ספק', error: err.message });
  }
};

// מחיקת ספק (סימון כלא פעיל)
export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // בדיקה אם יש הזמנות עבודה לספק
    const ordersCount = await WorkOrder.countDocuments({ supplier: id });
    if (ordersCount > 0) {
      // לא מוחקים — מסמנים כלא פעיל
      await Supplier.findByIdAndUpdate(id, { isActive: false });
      return res.json({ message: 'ספק סומן כלא פעיל (יש לו הזמנות)' });
    }

    await Supplier.findByIdAndDelete(id);
    res.json({ message: 'ספק נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת ספק', error: err.message });
  }
};

// ═════════════════════════════════════════════════════
//  הזמנות עבודה — CRUD
// ═════════════════════════════════════════════════════

// קבלת כל ההזמנות
export const getWorkOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.type) filter.type = req.query.type;

    const orders = await WorkOrder.find(filter)
      .populate('supplier', 'name phone')
      .sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת הזמנות', error: err.message });
  }
};

// יצירת הזמנת עבודה חדשה
export const createWorkOrder = async (req, res) => {
  try {
    const { date, supplier, type, quantity, pricePerUnit, notes } = req.body;
    const order = await WorkOrder.create({
      date: date || new Date(),
      supplier,
      type,
      quantity,
      pricePerUnit,
      notes,
    });
    const populated = await order.populate('supplier', 'name phone');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה ביצירת הזמנה', error: err.message });
  }
};

// עדכון הזמנת עבודה
export const updateWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // חישוב סכום כולל אם כמות או מחיר עודכנו
    if (updateData.quantity != null && updateData.pricePerUnit != null) {
      updateData.totalAmount = updateData.quantity * updateData.pricePerUnit;
    } else if (updateData.quantity != null || updateData.pricePerUnit != null) {
      const existing = await WorkOrder.findById(id);
      if (existing) {
        const qty = updateData.quantity ?? existing.quantity;
        const price = updateData.pricePerUnit ?? existing.pricePerUnit;
        updateData.totalAmount = qty * price;
      }
    }

    const order = await WorkOrder.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('supplier', 'name phone');

    if (!order) return res.status(404).json({ message: 'הזמנה לא נמצאה' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה בעדכון הזמנה', error: err.message });
  }
};

// מחיקת הזמנת עבודה
export const deleteWorkOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await WorkOrder.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ message: 'הזמנה לא נמצאה' });
    res.json({ message: 'הזמנה נמחקה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת הזמנה', error: err.message });
  }
};

// ═════════════════════════════════════════════════════
//  תשלומים — CRUD
// ═════════════════════════════════════════════════════

// קבלת כל התשלומים
export const getPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.supplier) filter.supplier = req.query.supplier;

    const payments = await SupplierPayment.find(filter)
      .populate('supplier', 'name phone')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת תשלומים', error: err.message });
  }
};

// יצירת תשלום חדש
export const createPayment = async (req, res) => {
  try {
    const { date, supplier, amount, method, notes } = req.body;
    const payment = await SupplierPayment.create({
      date: date || new Date(),
      supplier,
      amount,
      method,
      notes,
    });
    const populated = await payment.populate('supplier', 'name phone');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה ביצירת תשלום', error: err.message });
  }
};

// עדכון תשלום
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SupplierPayment.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate('supplier', 'name phone');
    if (!payment) return res.status(404).json({ message: 'תשלום לא נמצא' });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ message: 'שגיאה בעדכון תשלום', error: err.message });
  }
};

// מחיקת תשלום
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SupplierPayment.findByIdAndDelete(id);
    if (!payment) return res.status(404).json({ message: 'תשלום לא נמצא' });
    res.json({ message: 'תשלום נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת תשלום', error: err.message });
  }
};

// ═════════════════════════════════════════════════════
//  דשבורד — סיכום יתרות לכל ספק
// ═════════════════════════════════════════════════════

export const getDashboard = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });

    // סיכום הזמנות עבודה לכל ספק
    const orderTotals = await WorkOrder.aggregate([
      {
        $group: {
          _id: '$supplier',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    // סיכום תשלומים לכל ספק
    const paymentTotals = await SupplierPayment.aggregate([
      {
        $group: {
          _id: '$supplier',
          totalPayments: { $sum: 1 },
          totalPaid: { $sum: '$amount' },
        },
      },
    ]);

    // מיפוי למילון
    const orderMap = {};
    orderTotals.forEach((o) => {
      orderMap[o._id.toString()] = o;
    });

    const paymentMap = {};
    paymentTotals.forEach((p) => {
      paymentMap[p._id.toString()] = p;
    });

    // בניית דשבורד
    const dashboard = suppliers.map((sup) => {
      const sid = sup._id.toString();
      const orders = orderMap[sid] || { totalOrders: 0, totalQuantity: 0, totalAmount: 0 };
      const payments = paymentMap[sid] || { totalPayments: 0, totalPaid: 0 };
      const balance = orders.totalAmount - payments.totalPaid;

      return {
        supplier: {
          _id: sup._id,
          name: sup.name,
          phone: sup.phone,
        },
        totalOrders: orders.totalOrders,
        totalQuantity: orders.totalQuantity,
        totalWorkAmount: orders.totalAmount,
        totalPayments: payments.totalPayments,
        totalPaid: payments.totalPaid,
        balance, // חוב נותר (חיובי = ספק חייב לי)
      };
    });

    // סיכום כולל
    const totals = {
      totalWorkAmount: dashboard.reduce((s, d) => s + d.totalWorkAmount, 0),
      totalPaid: dashboard.reduce((s, d) => s + d.totalPaid, 0),
      totalBalance: dashboard.reduce((s, d) => s + d.balance, 0),
      totalQuantity: dashboard.reduce((s, d) => s + d.totalQuantity, 0),
    };

    res.json({ dashboard, totals });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת דשבורד', error: err.message });
  }
};

// ═════════════════════════════════════════════════════
//  היסטוריה מלאה לספק בודד
// ═════════════════════════════════════════════════════

export const getSupplierHistory = async (req, res) => {
  try {
    const { supplierId } = req.params;

    const [supplier, orders, payments] = await Promise.all([
      Supplier.findById(supplierId),
      WorkOrder.find({ supplier: supplierId }).sort({ date: -1 }),
      SupplierPayment.find({ supplier: supplierId }).sort({ date: -1 }),
    ]);

    if (!supplier) return res.status(404).json({ message: 'ספק לא נמצא' });

    // בניית היסטוריה כרונולוגית
    const history = [];

    orders.forEach((o) => {
      history.push({
        _id: o._id,
        date: o.date,
        type: 'work_order',
        description: `${o.type === 'tallit' ? 'טלית' : 'ציציות'} — ${o.quantity} יח׳ × ₪${o.pricePerUnit}`,
        amount: o.totalAmount,
        details: o,
      });
    });

    payments.forEach((p) => {
      history.push({
        _id: p._id,
        date: p.date,
        type: 'payment',
        description: `תשלום — ${p.method === 'cash' ? 'מזומן' : p.method === 'transfer' ? 'העברה' : p.method === 'check' ? "צ'ק" : p.method === 'bit' ? 'ביט' : 'אחר'}`,
        amount: -p.amount,
        details: p,
      });
    });

    // מיון לפי תאריך (ישן לחדש) וחישוב יתרה מצטברת
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    history.forEach((item) => {
      runningBalance += item.amount;
      item.runningBalance = runningBalance;
    });

    const totalWork = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      supplier,
      history,
      summary: {
        totalWork,
        totalPaid,
        balance: totalWork - totalPaid,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת היסטוריה', error: err.message });
  }
};
