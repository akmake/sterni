import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import csurf from 'csurf';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Imports ---
import authRoutes from './routes/auth.js';
import hallRoutes from './routes/hallRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import emailRoutes from './routes/emailRoutes.js'; // הקוד הישן שלך
import chatRoutes from './routes/chatRoutes.js';   // <--- הוסף את זה (הקובץ החדש שיצרנו)

import rateLimiter from './middlewares/rateLimiter.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { startEmailListener } from './services/emailListener.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DB Connection ---
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✔ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
await connectDB();

const app = express();

// --- Security & Config ---
app.use(helmet({
  crossOriginResourcePolicy: false // קריטי לתמונות!
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// הגדלת ה-Limit קריטית לקבלת קבצים במייל/צ'אט
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// הגשת קבצים סטטיים (העלאות)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =================================================================
// 🚨 איזור ה-Webhook (קריטי!)
// חייב להיות לפני ה-CSRF Protection כי ספק המייל (SendGrid וכו') לא שולח Token.
// =================================================================
app.use('/api/chat', chatRoutes); 


// --- CSRF ---
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },
});

// --- Public Routes ---
app.use('/api/auth', authRoutes);

app.get('/api/csrf-token', rateLimiter, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// --- Protected Routes ---
// כל מה שנמצא מתחת לשורה הזו דורש CSRF Token (הגנה למשתמשים בדפדפן)
app.use(csrfProtection); 

app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/halls', requireAuth, hallRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/emails', emailRoutes); // זה הנתיב הישן שלך, שקול אם אתה עדיין צריך אותו
app.use('/api/tasks', taskRoutes);

// Error Handling
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Form has been tampered with (CSRF Invalid)' });
  }
  console.error(err);
  res.status(err.statusCode || 500).json({ message: err.message || 'Internal Server Error' });
});

// הערה: אם אתה עובר מלא לשיטת ה-Webhook, ייתכן שלא תצטרך את startEmailListener
// אבל אם אתה רוצה לשמור על המנגנון הישן במקביל, תשאיר את זה.
startEmailListener(); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;