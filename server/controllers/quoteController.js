import mongoose from 'mongoose'; // <--- הוסף שורה זו בראש הקובץ
import Quote from '../models/Quote.js';
import Group from '../models/Group.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// --- שמירת הצעה ---
export const saveQuote = catchAsync(async (req, res, next) => {
  const { 
    name, 
    content, 
    clientName, 
    contactPerson, // מגיע כאובייקט { name, phone, email } מהקליינט
    dates, 
    pax, 
    eventType 
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
      contactPerson, // נשמר כאובייקט בתוך ה-Quote
      dates,
      pax,
      eventType,
      updatedAt: Date.now() 
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({ status: 'success', data: { quote } });
});

export const getAllQuotes = catchAsync(async (req, res, next) => {
  const quotes = await Quote.find()
    .select('name updatedAt clientName contactPerson dates pax isConverted')
    .sort('-updatedAt');
  res.status(200).json({ status: 'success', results: quotes.length, data: { quotes } });
});

export const getQuoteByName = catchAsync(async (req, res, next) => {
  const quote = await Quote.findOne({ name: req.params.name });
  if (!quote) return next(new AppError('לא נמצאה הצעה בשם זה', 404));
  res.status(200).json({ status: 'success', data: { quote } });
});

export const deleteQuote = catchAsync(async (req, res, next) => {
  const { name } = req.params; // הפרמטר שמגיע מה-URL (יכול להיות שם או ID)
  let deletedQuote;

  // בדיקה: האם זה נראה כמו ID של מונגו?
  if (mongoose.Types.ObjectId.isValid(name)) {
    // נסה למחוק לפי ID
    deletedQuote = await Quote.findByIdAndDelete(name);
  }

  // אם לא נמצא (או שזה לא היה ID), נסה למחוק לפי השם
  if (!deletedQuote) {
    deletedQuote = await Quote.findOneAndDelete({ name: name });
  }

  // אם עדיין לא נמצא כלום - החזר שגיאה
  if (!deletedQuote) {
    return next(new AppError('לא נמצאה הצעה למחיקה', 404));
  }

  res.status(204).json({ status: 'success', data: null });
});
// --- המרה לקבוצה (הגרסה הנכונה לפי Group Schema) ---
export const convertToGroup = catchAsync(async (req, res, next) => {
  const quote = await Quote.findOne({ name: req.params.name });
  if (!quote) return next(new AppError('לא נמצאה הצעה', 404));
  if (quote.isConverted) return next(new AppError('הצעה זו כבר הומרה לקבוצה', 400));

  // 1. מיפוי סוג אירוע לערכים המותרים ב-Enum בלבד (seminar/overnight)
  // אם סוג האירוע מכיל "שבת", "לינה" או "נופש" -> overnight. אחרת -> seminar.
  let validHostingType = 'seminar';
  const typeStr = (quote.eventType || '').toString();
  if (typeStr.includes('שבת') || typeStr.includes('נופש') || typeStr.includes('לינה') || typeStr.includes('overnight')) {
      validHostingType = 'overnight';
  }

  // 2. יצירת הקבוצה עם המבנה המקונן של contactPerson
  const newGroup = await Group.create({
    name: quote.clientName || quote.name,
    
    // כאן התיקון הקריטי: מעבירים אובייקט ולא שדות שטוחים
    contactPerson: {
        name: quote.contactPerson?.name || '',
        phone: quote.contactPerson?.phone || '',
        email: quote.contactPerson?.email || ''
    },

    startDate: quote.dates?.from,
    endDate: quote.dates?.to,

    // התיקון שביקשת: pax מההצעה הולך ל-minPax
    minPax: quote.pax || 0,
    pax: 0, 

    hostingType: validHostingType,
    notes: `נוצר אוטומטית מהצעת מחיר: ${quote.name}`
  });

  // עדכון סטטוס ההצעה
  quote.isConverted = true;
  quote.convertedGroupId = newGroup._id;
  await quote.save();

  res.status(201).json({ status: 'success', data: { group: newGroup } });
});