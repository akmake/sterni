import Payment from '../models/Payment.js';
import BillingProfile from '../models/Billingprofile.js';

import Group from '../models/Group.js';
import AppError from '../utils/AppError.js';

// ═══════════════════════════════════════════════
// 📊 סיכום כספי לקבוצה (Dashboard Data)
// ═══════════════════════════════════════════════
export const getGroupFinancialSummary = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const [billing, payments, group] = await Promise.all([
      BillingProfile.findOne({ group: groupId }),
      Payment.find({ group: groupId }).sort({ paymentDate: -1 }).populate('recordedBy', 'name').populate('confirmedBy', 'name'),
      Group.findById(groupId).select('name pax startDate endDate contactPerson'),
    ]);

    if (!group) return next(new AppError('קבוצה לא נמצאה', 404));

    // חישוב סיכומים
    const confirmedTotal = payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingTotal = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpected = billing?.totalExpected || 0;

    // חישוב הנחה
    let discountAmount = 0;
    if (billing?.discount) {
      if (billing.discount.type === 'percentage') {
        discountAmount = totalExpected * (billing.discount.value / 100);
      } else {
        discountAmount = billing.discount.value;
      }
    }

    const netExpected = Math.max(0, totalExpected - discountAmount);
    const remaining = Math.max(0, netExpected - confirmedTotal);
    const paidPercentage = netExpected > 0 ? Math.round((confirmedTotal / netExpected) * 100) : 0;

    // סטטוס כולל
    let overallStatus = 'no_billing';
    if (netExpected > 0) {
      if (confirmedTotal >= netExpected) overallStatus = 'paid_full';
      else if (confirmedTotal > 0) overallStatus = 'partial';
      else if (pendingTotal > 0) overallStatus = 'pending';
      else overallStatus = 'unpaid';
    }

    // אזהרת תשלום באיחור
    const isOverdue = billing?.dueDate && new Date(billing.dueDate) < new Date() && overallStatus !== 'paid_full';

    res.json({
      group: {
        _id: group._id,
        name: group.name,
        pax: group.pax,
        startDate: group.startDate,
        endDate: group.endDate,
        contactPerson: group.contactPerson,
      },
      billing: billing || null,
      payments,
      summary: {
        totalExpected: netExpected,
        discountAmount,
        confirmedTotal,
        pendingTotal,
        remaining,
        paidPercentage,
        overallStatus,
        isOverdue,
        dueDate: billing?.dueDate || null,
        paymentCount: payments.length,
      },
    });
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════
// 💰 CRUD תשלומים
// ═══════════════════════════════════════════════

// --- כל התשלומים לקבוצה ---
export const getPaymentsForGroup = async (req, res, next) => {
  try {
    const payments = await Payment.find({ group: req.params.groupId })
      .sort({ paymentDate: -1 })
      .populate('recordedBy', 'name email')
      .populate('confirmedBy', 'name email');

    res.json(payments);
  } catch (err) { next(err); }
};

// --- תשלום בודד ---
export const getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate('recordedBy', 'name email')
      .populate('confirmedBy', 'name email');

    if (!payment) return next(new AppError('תשלום לא נמצא', 404));
    res.json(payment);
  } catch (err) { next(err); }
};

// --- יצירת תשלום חדש ---
export const createPayment = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // וידוא שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) return next(new AppError('קבוצה לא נמצאה', 404));

    const paymentData = {
      group: groupId,
      type: req.body.type,
      amount: req.body.amount,
      currency: req.body.currency || 'ILS',
      paymentDate: req.body.paymentDate,
      referenceNumber: req.body.referenceNumber,
      description: req.body.description,
      status: req.body.status || 'pending',
      internalNotes: req.body.internalNotes,
      tags: req.body.tags || [],
      recordedBy: req.user.id,
    };

    // טיפול בקבצים מצורפים (אם יש)
    if (req.files && req.files.length > 0) {
      paymentData.attachments = req.files.map(f => ({
        filename: f.filename,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        path: `/uploads/payments/${f.filename}`,
      }));
    }

    const payment = await Payment.create(paymentData);
    const populated = await payment.populate('recordedBy', 'name email');

    res.status(201).json(populated);
  } catch (err) { next(err); }
};

// --- עדכון תשלום ---
export const updatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return next(new AppError('תשלום לא נמצא', 404));

    // עדכון שדות
    const allowedFields = ['type', 'amount', 'currency', 'paymentDate', 'referenceNumber', 'description', 'status', 'internalNotes', 'tags'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    }

    // אם אושר - שמור מי אישר ומתי
    if (req.body.status === 'confirmed' && payment.status !== 'confirmed') {
      payment.confirmedBy = req.user.id;
      payment.confirmedAt = new Date();
    }

    // קבצים חדשים
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(f => ({
        filename: f.filename,
        originalName: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        path: `/uploads/payments/${f.filename}`,
      }));
      payment.attachments.push(...newAttachments);
    }

    await payment.save();
    const populated = await payment.populate(['recordedBy', 'confirmedBy']);

    res.json(populated);
  } catch (err) { next(err); }
};

// --- מחיקת תשלום ---
export const deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.paymentId);
    if (!payment) return next(new AppError('תשלום לא נמצא', 404));
    res.json({ message: 'התשלום נמחק בהצלחה' });
  } catch (err) { next(err); }
};

// --- מחיקת קובץ מצורף בודד ---
export const deleteAttachment = async (req, res, next) => {
  try {
    const { paymentId, attachmentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) return next(new AppError('תשלום לא נמצא', 404));

    payment.attachments = payment.attachments.filter(
      a => a._id.toString() !== attachmentId
    );

    await payment.save();
    res.json(payment);
  } catch (err) { next(err); }
};

// --- אישור תשלום ---
export const confirmPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return next(new AppError('תשלום לא נמצא', 404));

    payment.status = 'confirmed';
    payment.confirmedBy = req.user.id;
    payment.confirmedAt = new Date();

    await payment.save();
    const populated = await payment.populate(['recordedBy', 'confirmedBy']);

    res.json(populated);
  } catch (err) { next(err); }
};

// --- דחיית תשלום ---
export const rejectPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return next(new AppError('תשלום לא נמצא', 404));

    payment.status = 'rejected';
    payment.internalNotes = req.body.reason
      ? `${payment.internalNotes || ''}\nנדחה: ${req.body.reason}`.trim()
      : payment.internalNotes;

    await payment.save();
    res.json(payment);
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════
// 📋 פרופיל חיוב (Billing Profile)
// ═══════════════════════════════════════════════

export const getBillingProfile = async (req, res, next) => {
  try {
    let billing = await BillingProfile.findOne({ group: req.params.groupId });
    if (!billing) {
      // יצירה אוטומטית של פרופיל ריק
      billing = await BillingProfile.create({
        group: req.params.groupId,
        createdBy: req.user.id,
      });
    }
    res.json(billing);
  } catch (err) { next(err); }
};

export const updateBillingProfile = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    let billing = await BillingProfile.findOne({ group: groupId });
    if (!billing) {
      billing = new BillingProfile({ group: groupId, createdBy: req.user.id });
    }

    const allowedFields = [
      'totalExpected', 'currency', 'discount', 'vatRate', 'includesVat',
      'paymentTerms', 'customTermsDescription', 'dueDate', 'lineItems', 'notes', 'linkedQuote',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        billing[field] = req.body[field];
      }
    }

    // חישוב אוטומטי של totalExpected מתוך lineItems
    if (req.body.lineItems && req.body.lineItems.length > 0) {
      billing.totalExpected = req.body.lineItems.reduce((sum, item) => {
        const total = (item.quantity || 1) * (item.unitPrice || 0);
        return sum + total;
      }, 0);
    }

    await billing.save();
    res.json(billing);
  } catch (err) { next(err); }
};


// ═══════════════════════════════════════════════
// 📊 דוח כללי - כל הקבוצות
// ═══════════════════════════════════════════════
export const getAllGroupsFinancialReport = async (req, res, next) => {
  try {
    const groups = await Group.find({}).select('name pax startDate endDate contactPerson').sort({ startDate: -1 });

    const billings = await BillingProfile.find({});
    const billingMap = new Map(billings.map(b => [b.group.toString(), b]));

    // Aggregate payments per group
    const paymentAgg = await Payment.aggregate([
      { $match: { status: { $in: ['pending', 'confirmed'] } } },
      {
        $group: {
          _id: { group: '$group', status: '$status' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        }
      }
    ]);

    const paymentMap = new Map();
    for (const row of paymentAgg) {
      const gid = row._id.group.toString();
      if (!paymentMap.has(gid)) paymentMap.set(gid, { confirmed: 0, pending: 0, confirmedCount: 0, pendingCount: 0 });
      const entry = paymentMap.get(gid);
      entry[row._id.status] = row.total;
      entry[`${row._id.status}Count`] = row.count;
    }

    const report = groups.map(g => {
      const billing = billingMap.get(g._id.toString());
      const pay = paymentMap.get(g._id.toString()) || { confirmed: 0, pending: 0 };

      const totalExpected = billing?.totalExpected || 0;
      let discountAmount = 0;
      if (billing?.discount) {
        discountAmount = billing.discount.type === 'percentage'
          ? totalExpected * (billing.discount.value / 100)
          : billing.discount.value;
      }
      const netExpected = Math.max(0, totalExpected - discountAmount);
      const remaining = Math.max(0, netExpected - pay.confirmed);
      const paidPct = netExpected > 0 ? Math.round((pay.confirmed / netExpected) * 100) : 0;

      let status = 'no_billing';
      if (netExpected > 0) {
        if (pay.confirmed >= netExpected) status = 'paid_full';
        else if (pay.confirmed > 0) status = 'partial';
        else if (pay.pending > 0) status = 'pending';
        else status = 'unpaid';
      }

      const isOverdue = billing?.dueDate && new Date(billing.dueDate) < new Date() && status !== 'paid_full';

      return {
        _id: g._id,
        name: g.name,
        pax: g.pax,
        startDate: g.startDate,
        endDate: g.endDate,
        contactPerson: g.contactPerson,
        totalExpected: netExpected,
        confirmedTotal: pay.confirmed,
        pendingTotal: pay.pending,
        remaining,
        paidPercentage: paidPct,
        status,
        isOverdue,
        dueDate: billing?.dueDate,
      };
    });

    // סיכום כולל
    const totals = report.reduce((acc, r) => {
      acc.totalExpected += r.totalExpected;
      acc.confirmedTotal += r.confirmedTotal;
      acc.pendingTotal += r.pendingTotal;
      acc.remaining += r.remaining;
      return acc;
    }, { totalExpected: 0, confirmedTotal: 0, pendingTotal: 0, remaining: 0 });

    res.json({ groups: report, totals });
  } catch (err) { next(err); }
};