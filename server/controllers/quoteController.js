import Quote from '../models/Quote.js';
import AppError from '../utils/AppError.js'; // בהנחה שזה קיים אצלך לפי הניתוח
import catchAsync from '../utils/catchAsync.js'; // או איך שאתה עוטף שגיאות

export const saveQuote = catchAsync(async (req, res, next) => {
  const { name, content } = req.body;

  if (!name || !content) {
    return next(new AppError('יש לספק שם ותוכן להצעה', 400));
  }

  // שימוש ב-upsert: אם קיים מעדכן, אם לא קיים יוצר חדש
  const quote = await Quote.findOneAndUpdate(
    { name },
    { content, name, updatedAt: Date.now() },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: { quote }
  });
});

export const getAllQuotes = catchAsync(async (req, res, next) => {
  // מחזיר רק שמות ותאריכים כדי לא להעמיס (בלי התוכן הכבד)
  const quotes = await Quote.find().select('name updatedAt').sort('-updatedAt');

  res.status(200).json({
    status: 'success',
    results: quotes.length,
    data: { quotes }
  });
});

export const getQuoteByName = catchAsync(async (req, res, next) => {
  const quote = await Quote.findOne({ name: req.params.name });

  if (!quote) {
    return next(new AppError('לא נמצאה הצעה בשם זה', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { quote }
  });
});

export const deleteQuote = catchAsync(async (req, res, next) => {
  await Quote.findOneAndDelete({ name: req.params.name });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});