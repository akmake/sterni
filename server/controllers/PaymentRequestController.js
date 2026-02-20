import PaymentRequest from '../models/PaymentRequest.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// --- Save payment request ---
export const savePaymentRequest = catchAsync(async (req, res, next) => {
  const {
    name,
    content,
    clientName,
    contactPerson,
    totalAmount,
    currency,
    description,
    dueDate,
    paymentDetails,
    htmlBody
  } = req.body;

  if (!name) {
    return next(new AppError('יש לספק שם לדרישת התשלום', 400));
  }

  const paymentRequest = await PaymentRequest.findOneAndUpdate(
    { name, owner: req.user.id },
    {
      name,
      content: content || {},
      clientName,
      contactPerson,
      totalAmount,
      currency,
      description,
      dueDate,
      paymentDetails,
      htmlBody: htmlBody || '',
      owner: req.user.id,
      updatedAt: Date.now()
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({ status: 'success', data: { paymentRequest } });
});

// --- Get all payment requests for current user ---
export const getPaymentRequests = catchAsync(async (req, res, next) => {
  const paymentRequests = await PaymentRequest.find({ owner: req.user.id })
    .select('name totalAmount status clientName contactPerson dueDate updatedAt')
    .sort('-updatedAt');
  
  res.status(200).json({
    status: 'success',
    results: paymentRequests.length,
    data: { paymentRequests }
  });
});

// --- Get single payment request ---
export const getPaymentRequest = catchAsync(async (req, res, next) => {
  const paymentRequest = await PaymentRequest.findOne({
    _id: req.params.id,
    owner: req.user.id
  });

  if (!paymentRequest) {
    return next(new AppError('דרישת תשלום לא נמצאה', 404));
  }

  res.status(200).json({ status: 'success', data: { paymentRequest } });
});

// --- Delete payment request ---
export const deletePaymentRequest = catchAsync(async (req, res, next) => {
  const paymentRequest = await PaymentRequest.findOneAndDelete({
    _id: req.params.id,
    owner: req.user.id
  });

  if (!paymentRequest) {
    return next(new AppError('דרישת תשלום לא נמצאה למחיקה', 404));
  }

  res.status(204).json({ status: 'success', data: null });
});

// --- Update payment request status ---
export const updatePaymentRequestStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!['draft', 'sent', 'paid', 'cancelled'].includes(status)) {
    return next(new AppError('סטטוס לא תקין', 400));
  }

  const paymentRequest = await PaymentRequest.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    { status, updatedAt: Date.now() },
    { new: true }
  );

  if (!paymentRequest) {
    return next(new AppError('דרישת תשלום לא נמצאה', 404));
  }

  res.status(200).json({ status: 'success', data: { paymentRequest } });
});

// --- Send payment request to client ---
export const sendPaymentRequest = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError('יש לספק כתובת מייל', 400));
  }

  const paymentRequest = await PaymentRequest.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    {
      $push: {
        sentTo: {
          email,
          sentAt: new Date()
        }
      },
      status: 'sent'
    },
    { new: true }
  );

  if (!paymentRequest) {
    return next(new AppError('דרישת תשלום לא נמצאה', 404));
  }

  // TODO: יישם שליחת מייל בפועל
  res.status(200).json({ status: 'success', data: { paymentRequest } });
});
