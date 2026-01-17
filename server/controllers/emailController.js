import nodemailer from 'nodemailer';
import fs from 'fs';
import SystemConfig from '../models/SystemConfig.js';
import EmailAccount from '../models/EmailAccount.js';
import { decrypt } from '../utils/encryption.js'; // וודא שיש לך את הקובץ הזה ב-utils

export const sendAttachmentEmail = async (req, res) => {
    let filePath = null;

    try {
        // 1. בדיקת קבצים
        if (!req.file) {
            return res.status(400).json({ message: 'לא צורף קובץ PDF' });
        }
        filePath = req.file.path;

        const { email, subject, body } = req.body;

        // 2. זיהוי החשבון השולח (מערכת הניתוב)
        const config = await SystemConfig.findOne();
        
        let senderAccount = null;
        
        // אם מוגדר מייל כספים - נשתמש בו. אחרת, ננסה מייל תפעול או נחזיר שגיאה.
        if (config && config.financeEmailId) {
            senderAccount = await EmailAccount.findById(config.financeEmailId);
        }

        if (!senderAccount) {
            // Fallback: נסה לקחת את החשבון הראשון שקיים אם אין הגדרה ספציפית
            senderAccount = await EmailAccount.findOne();
        }

        if (!senderAccount) {
            throw new Error('לא הוגדר חשבון מייל לשליחה בהגדרות המערכת (Finance Email)');
        }

        // 3. פענוח הסיסמה והכנת ה-Transporter
        const decryptedPassword = decrypt({
            content: senderAccount.encryptedPassword,
            iv: senderAccount.iv
        });

        const transporter = nodemailer.createTransport({
            host: senderAccount.host,
            port: senderAccount.port,
            secure: senderAccount.port === 465, // true ל-465, false לאחרים
            auth: {
                user: senderAccount.user,
                pass: decryptedPassword
            }
        });

        // 4. שליחת המייל בפועל
        const info = await transporter.sendMail({
            from: `"${senderAccount.friendlyName}" <${senderAccount.user}>`, // השם שיוצג ללקוח
            to: email,
            subject: subject,
            text: body, // גרסת טקסט
            html: body.replace(/\n/g, '<br>'), // המרה פשוטה ל-HTML
            attachments: [
                {
                    filename: req.file.originalname || 'document.pdf', // השם המקורי (למשל payment_request_X.pdf)
                    path: filePath // הנתיב בשרת
                }
            ]
        });

        console.log('Message sent: %s', info.messageId);

        // 5. ניקוי הקובץ הזמני
        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

        res.status(200).json({ success: true, message: 'המייל נשלח בהצלחה' });

    } catch (error) {
        console.error('Error sending email:', error);
        
        // ניקוי גם במקרה של שגיאה
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(500).json({ message: 'שגיאה בשליחת המייל: ' + error.message });
    }
};