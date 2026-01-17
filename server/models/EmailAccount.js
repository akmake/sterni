import mongoose from 'mongoose';

const emailAccountSchema = new mongoose.Schema({
  friendlyName: { type: String, required: true, unique: true }, // שם מזהה למנהל
  host: { type: String, required: true }, // smtp.gmail.com
  port: { type: Number, default: 587 },
  secure: { type: Boolean, default: false }, 
  user: { type: String, required: true }, 
  encryptedPassword: { type: String, required: true }, // הסיסמה המוצפנת
  iv: { type: String, required: true } // וקטור האתחול (חובה לפענוח)
}, { timestamps: true });

export default mongoose.model('EmailAccount', emailAccountSchema);