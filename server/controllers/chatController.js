import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import { transporter, formatEmailHtml } from '../services/emailService.js';
import { sock } from '../services/whatsappService.js'; 
import AppError from '../utils/AppError.js'; 

// הגדרת נתיב בסיס לקריאת קבצים (עבור שליחת קבצים בוואצפ)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// הנתיב לתיקיית ההעלאות הציבורית של הקליינט
const UPLOADS_PATH = path.join(__dirname, '../../client/public'); 

// --- שליחת הודעה (משולב: מייל + וואצפ) ---
export const sendMessageToClient = async (req, res, next) => {
  try {
    const { ticketId, clientEmail, content, type, fileUrl, clientName, clientPhone } = req.body;

    // 1. שמירה/עדכון של איש הקשר במסד הנתונים
    let contact = await Contact.findOne({ email: clientEmail });
    if (!contact) {
        contact = await Contact.create({
            name: clientName || clientEmail.split('@')[0],
            email: clientEmail,
            phone: clientPhone || ''
        });
    } else {
        // עדכון טלפון אם התקבל חדש (והמקורי היה ריק או שונה), וזמן פעילות
        if (clientPhone) contact.phone = clientPhone;
        contact.lastActive = new Date();
        await contact.save();
    }

    // 2. שמירת ההודעה ב-DB
    const newMessage = await Message.create({
      ticketId,
      sender: 'admin',
      clientEmail,
      content,
      type: type || 'text',
      fileUrl,
      source: 'web', // מסמן שההודעה יצאה מממשק הניהול
      isRead: true
    });

    // 3. לוגיקת שליחה (Routing) - וואצפ ומייל

    // --- אופציה א': שליחה בוואצפ (אם יש טלפון והסוקט מחובר) ---
    if (contact.phone && sock) {
        const jid = `${contact.phone}@s.whatsapp.net`;
        try {
            // אם יש קובץ מצורף - שולחים אותו כקובץ אמיתי (Buffer)
            if (fileUrl) {
                // בניית נתיב מלא לקובץ בדיסק
                // fileUrl מגיע בפורמט: /uploads/filename.ext
                // אנחנו צריכים את הנתיב המלא במערכת ההפעלה כדי לקרוא אותו
                const fullPath = path.join(UPLOADS_PATH, fileUrl); 
                
                if (fs.existsSync(fullPath)) {
                    const fileBuffer = fs.readFileSync(fullPath);
                    const isImage = type === 'image' || fileUrl.match(/\.(jpg|jpeg|png|gif)$/i);
                    const isVideo = type === 'video' || fileUrl.match(/\.(mp4)$/i);

                    if (isImage) {
                        await sock.sendMessage(jid, { image: fileBuffer, caption: content });
                    } else if (isVideo) {
                        await sock.sendMessage(jid, { video: fileBuffer, caption: content });
                    } else {
                        // ברירת מחדל למסמכים (PDF וכו')
                        await sock.sendMessage(jid, { 
                            document: fileBuffer, 
                            mimetype: 'application/pdf', // אפשר לשפר זיהוי דינמי אם צריך
                            fileName: path.basename(fileUrl) 
                        });
                    }
                    console.log(`📤 נשלח קובץ בוואצפ ל-${contact.phone}`);
                } else {
                    // מקרה קצה: הקובץ רשום ב-DB אך לא נמצא בתיקייה
                    await sock.sendMessage(jid, { text: `${content}\n\n(קובץ מצורף חסר בשרת)` });
                }
            } else {
                // שליחת הודעת טקסט רגילה
                await sock.sendMessage(jid, { text: content });
                console.log(`📤 נשלחה הודעת וואצפ ל-${contact.phone}`);
            }
        } catch (waError) {
            console.error('❌ שגיאה בשליחה לוואצפ:', waError);
            // אנחנו לא עוצרים את הריצה (לא עושים return) כדי שהמייל עדיין יישלח
        }
    }

    // --- אופציה ב': שליחה במייל (תמיד, כגיבוי או כערוץ ראשי) ---
    if (clientEmail) {
        const mailOptions = {
            from: `"Support Team" <${process.env.EMAIL_USER}>`,
            to: clientEmail,
            subject: `Re: פנייה #${ticketId}`,
            html: formatEmailHtml(content),
        };

        if (fileUrl) {
            // במייל שולחים כקישור להורדה (כדי לא להכביד על ה-SMTP או לחסום את המייל)
            // ניתן לשנות ל-attachments אם רוצים, אך קישור עדיף לקבצים גדולים
            mailOptions.html += `<br><br><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}${fileUrl}">לחץ לצפייה בקובץ המצורף</a>`;
        }

        await transporter.sendMail(mailOptions);
        console.log(`📧 נשלח מייל ל-${clientEmail}`);
    }

    res.status(201).json({ status: 'success', data: newMessage, contact });

  } catch (error) {
    console.error('Error sending message:', error);
    next(new AppError(error.message, 500));
  }
};

// --- קבלת רשימת שיחות (Dashboard) ---
export const getConversations = async (req, res, next) => {
    try {
        // קיבוץ לפי TicketID כדי להציג רשימת שיחות ייחודיות
        const messages = await Message.aggregate([
            { $sort: { createdAt: -1 } }, // מיון לפי הזמן החדש ביותר
            { $group: {
                _id: "$ticketId",
                lastMessage: { $first: "$$ROOT" }, // לוקח את ההודעה האחרונה
                clientEmail: { $first: "$clientEmail" }
            }}
        ]);

        // העשרת המידע עם פרטי איש הקשר (שם וטלפון)
        const enrichedConversations = await Promise.all(messages.map(async (conv) => {
            const contact = await Contact.findOne({ email: conv.clientEmail });
            return {
                ticketId: conv._id,
                from: conv.clientEmail,
                clientName: contact ? contact.name : conv.clientEmail,
                clientPhone: contact ? contact.phone : '', // חשוב כדי לדעת אם אפשר לשלוח וואצפ
                subject: conv.lastMessage.content ? conv.lastMessage.content.substring(0, 30) : 'קובץ מצורף',
                createdAt: conv.lastMessage.createdAt,
                lastMessage: conv.lastMessage
            };
        }));

        res.status(200).json({ status: 'success', data: enrichedConversations });
    } catch (error) {
        next(new AppError(error.message, 500));
    }
};