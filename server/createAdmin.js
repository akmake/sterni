import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from './models/userModel.js';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ מחובר ל־MongoDB');

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Admin';

    if (!email || !password) {
      console.error('❌ הגדר ADMIN_EMAIL ו-ADMIN_PASSWORD ב-.env לפני הרצת הסקריפט');
      return process.exit(1);
    }

    const existing = await User.findOne({ email });

    if (existing) {
      console.log('⚠️ משתמש כבר קיים');
      return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      passwordHash: hashedPassword,
      role: 'admin',
    });

    console.log(`🎉 נוצר משתמש מנהל: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ שגיאה ביצירת מנהל:', err);
    process.exit(1);
  }
};

createAdmin();
