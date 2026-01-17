import nodemailer from 'nodemailer';
import EmailAccount from '../models/EmailAccount.js';
import SystemConfig from '../models/SystemConfig.js';
import { encrypt, decrypt } from '../utils/encryption.js';

// 1. הוספת/עדכון חשבון מייל
export const saveEmailAccount = async (req, res) => {
  try {
    const { id, friendlyName, host, port, user, password } = req.body;
    
    // הצפנת הסיסמה
    const { content, iv } = encrypt(password);

    let account;
    if (id) {
      // עדכון קיים
      account = await EmailAccount.findByIdAndUpdate(id, {
        friendlyName, host, port, user, encryptedPassword: content, iv
      }, { new: true });
    } else {
      // יצירה חדש
      account = await EmailAccount.create({
        friendlyName, host, port, user, encryptedPassword: content, iv
      });
    }
    res.status(200).json({ success: true, account });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. בדיקת חיבור (Test Connection)
export const testConnection = async (req, res) => {
  try {
    const { host, port, user, password } = req.body;
    
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass: password }
    });

    await transporter.verify(); // מנסה להתחבר ל-SMTP
    res.status(200).json({ success: true, message: 'החיבור הצליח!' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'חיבור נכשל: ' + error.message });
  }
};

// 3. שליפת כל החשבונות (עבור הטבלה)
export const getAccounts = async (req, res) => {
  try {
    const accounts = await EmailAccount.find({}, '-encryptedPassword -iv'); // לא מחזירים סיסמאות!
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. עדכון הגדרות ניתוב (איזה מייל הולך לאן)
// 4. עדכון הגדרות ניתוב (איזה מייל הולך לאן)
export const updateRouting = async (req, res) => {
  try {
    console.log('📥 קיבלתי בקשה לעדכון ניתוב:', req.body); // <--- בדיקה 1: מה מגיע מהלקוח?

    const { financeEmailId, opsEmailId, targetWhatsAppEmail } = req.body;
    
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({ financeEmailId, opsEmailId, targetWhatsAppEmail });
    } else {
      // עדכון שדות רק אם הם קיימים בבקשה
      if (financeEmailId) config.financeEmailId = financeEmailId;
      if (opsEmailId) config.opsEmailId = opsEmailId;
      
      // טיפול מיוחד למייל יעד (כי הוא סטרינג)
      if (targetWhatsAppEmail !== undefined) {
          config.targetWhatsAppEmail = targetWhatsAppEmail;
      }

      await config.save();
    }

    console.log('💾 נשמר במסד הנתונים:', config); // <--- בדיקה 2: מה נשמר בפועל?
    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ שגיאה בעדכון:', error);
    res.status(500).json({ message: error.message });
  }
};

// 5. שליפת הגדרות נוכחיות
export const getConfig = async (req, res) => {
  try {
    const config = await SystemConfig.findOne();
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};