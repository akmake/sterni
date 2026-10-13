import mongoose from 'mongoose';
import HotelOrder from '../models/HotelOrder.js';
import Hotel from '../models/Hotel.js';
import { renderHotelOrderPdf } from '../services/hotelOrderPdf.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const downloadHotelOrderPdf = catchAsync(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError('מזהה הזמנה לא תקין', 400));
  const type = req.query.type || 'quote';
  if (!['quote', 'confirmation'].includes(type)) return next(new AppError('סוג מסמך לא תקין', 400));
  const order = await HotelOrder.findById(req.params.id).lean();
  if (!order) return next(new AppError('ההזמנה לא נמצאה', 404));
  if (mongoose.isValidObjectId(order.hotelId)) order.hotel = await Hotel.findById(order.hotelId).select('name').lean();
  const pdf = await renderHotelOrderPdf(order, { type, includePayment: req.query.includePayment === 'true' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="hotel-${type}-${order.orderNumber}.pdf"`);
  res.send(pdf);
});
