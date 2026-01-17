import nodemailer from 'nodemailer';
import SystemConfig from '../models/SystemConfig.js';
import EmailAccount from '../models/EmailAccount.js';
import { decrypt } from '../utils/encryption.js';

// --- פונקציה פנימית ליצירת Transporter לפי סוג ---
const createDynamicTransporter = async (type) => {
  // 1. טעינת הגדרות הניתוב
  const config = await SystemConfig.findOne();
  if (!config) throw new Error('הגדרות מערכת לא נמצאו! יש להגדיר מיילים בממשק הניהול.');

  // 2. בחירת ה-ID המתאים
  let accountId;
  if (type === 'finance') accountId = config.financeEmailId;
  else if (type === 'ops') accountId = config.opsEmailId;
  else throw new Error('סוג ערוץ מייל לא חוקי');

  if (!accountId) throw new Error(`לא הוגדר חשבון מייל עבור ערוץ ${type}`);

  // 3. שליפת פרטי החשבון מה-DB
  const account = await EmailAccount.findById(accountId);
  if (!account) throw new Error('חשבון המייל המוגדר לא נמצא בבסיס הנתונים');

  // 4. פענוח הסיסמה ויצירת Transporter
  const decryptedPass = decrypt({ content: account.encryptedPassword, iv: account.iv });

  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure, // true for 465
    auth: {
      user: account.user,
      pass: decryptedPass
    }
  });
};

// --- פונקציות השליחה ---

// דוגמה 1: שליחת הצעת מחיר / דרישת תשלום (כספים)
export const sendFinanceEmail = async (to, subject, html, attachments = []) => {
  const transporter = await createDynamicTransporter('finance');
  
  // שליפת כתובת השולח כדי להציג אותה ב-From
  const config = await SystemConfig.findOne().populate('financeEmailId');
  // הגנה למקרה שהחשבון נמחק אך ההגדרה נשארה
  const fromAddress = config?.financeEmailId?.user || 'noreply@system.com';

  return transporter.sendMail({
    from: `"מחלקת כספים" <${fromAddress}>`,
    to,
    subject,
    html,
    attachments
  });
};

// דוגמה 2: התראות מערכת / וואצאפ (תפעול)
// 🚨 כאן היה התיקון הקריטי: הוספתי את attachments כפרמטר
export const sendOpsEmail = async (to, subject, htmlContent, attachments = []) => {
  const transporter = await createDynamicTransporter('ops');
  
  const config = await SystemConfig.findOne().populate('opsEmailId');
  const fromAddress = config?.opsEmailId?.user || 'noreply@system.com';

  const safeHtml = htmlContent || '';

  return transporter.sendMail({
    from: `"מערכת תפעול" <${fromAddress}>`,
    to,
    subject,
    html: safeHtml,
    text: safeHtml.replace(/<[^>]*>?/gm, ''), // המרה אוטומטית לטקסט רגיל
    attachments: attachments // <--- הוספנו את זה! עכשיו הקבצים יישלחו
  });
};

// --- פונקציות עזר (חובה עבור chatController) ---
export const formatEmailHtml = (content) => {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="background-color: #f4f4f4; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${content}
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #888;">
          נשלח אוטומטית ממערכת הניהול
        </div>
      </div>
    </div>
  `;
};