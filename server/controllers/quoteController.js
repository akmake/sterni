import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import Group from '../models/Group.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// --- Save quote (with htmlBody) ---
export const saveQuote = catchAsync(async (req, res, next) => {
  const {
    name,
    content,
    clientName,
    contactPerson,
    dates,
    pax,
    eventType,
    htmlBody    // ★ NEW: full rendered HTML
  } = req.body;

  if (!name || !content) {
    return next(new AppError('יש לספק שם ותוכן להצעה', 400));
  }

  const quote = await Quote.findOneAndUpdate(
    { name },
    {
      name,
      content,
      clientName,
      contactPerson,
      dates,
      pax,
      eventType,
      htmlBody: htmlBody || '',   // ★ Save the full HTML body
      updatedAt: Date.now()
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({ status: 'success', data: { quote } });
});

export const getAllQuotes = catchAsync(async (req, res, next) => {
  const quotes = await Quote.find()
    .select('name updatedAt clientName contactPerson dates pax isConverted eventType')
    .sort('-updatedAt');
  res.status(200).json({ status: 'success', results: quotes.length, data: { quotes } });
});

export const getQuoteByName = catchAsync(async (req, res, next) => {
  const quote = await Quote.findOne({ name: req.params.name });
  if (!quote) return next(new AppError('לא נמצאה הצעה בשם זה', 404));
  res.status(200).json({ status: 'success', data: { quote } });
});

export const deleteQuote = catchAsync(async (req, res, next) => {
  const { name } = req.params;
  let deletedQuote;

  if (mongoose.Types.ObjectId.isValid(name)) {
    deletedQuote = await Quote.findByIdAndDelete(name);
  }

  if (!deletedQuote) {
    deletedQuote = await Quote.findOneAndDelete({ name: name });
  }

  if (!deletedQuote) {
    return next(new AppError('לא נמצאה הצעה למחיקה', 404));
  }

  res.status(204).json({ status: 'success', data: null });
});

// --- Convert to group ---
export const convertToGroup = catchAsync(async (req, res, next) => {
  const quote = await Quote.findOne({ name: req.params.name });
  if (!quote) return next(new AppError('לא נמצאה הצעה', 404));
  if (quote.isConverted) return next(new AppError('הצעה זו כבר הומרה לקבוצה', 400));

  let validHostingType = 'seminar';
  const typeStr = (quote.eventType || '').toString();
  if (typeStr.includes('שבת') || typeStr.includes('נופש') || typeStr.includes('לינה') || typeStr.includes('overnight')) {
    validHostingType = 'overnight';
  }

  const newGroup = await Group.create({
    name: quote.clientName || quote.name,
    contactPerson: {
      name: quote.contactPerson?.name || '',
      phone: quote.contactPerson?.phone || '',
      email: quote.contactPerson?.email || ''
    },
    startDate: quote.dates?.from,
    endDate: quote.dates?.to,
    minPax: quote.pax || 0,
    pax: 0,
    hostingType: validHostingType,
    notes: `נוצר אוטומטית מהצעת מחיר: ${quote.name}`
  });

  quote.isConverted = true;
  quote.convertedGroupId = newGroup._id;
  await quote.save();

  res.status(201).json({ status: 'success', data: { group: newGroup } });
});

// ★ NEW: Get quote dates for calendar (lightweight endpoint)
export const getQuoteDates = catchAsync(async (req, res, next) => {
  const quotes = await Quote.find({ isConverted: { $ne: true } })
    .select('dates clientName name')
    .lean();

  res.status(200).json({ status: 'success', data: { quotes } });
});