import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// הגדרת ה-Transporter (למשל Gmail, SendGrid, AWS SES)
export const transporter = nodemailer.createTransport({
  service: 'gmail', // או host/port עבור שירותים מקצועיים
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// פונקציית עזר לפרמוט HTML של המייל שייראה טוב
export const formatEmailHtml = (content) => {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
      <p>${content.replace(/\n/g, '<br>')}</p>
      <br>
      <hr>
      <p style="font-size: 12px; color: #888;">הודעה זו נשלחה דרך מערכת הצ'אט. נא להשיב למייל זה כדי להמשיך את השיחה.</p>
    </div>
  `;
};