import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// ייבוא הסוקט בצורה שתתעדכן בזמן אמת (Live Binding)
import { sock } from './whatsappService.js';

// --- הגדרת נתיב השמירה בתוך ה-CLIENT ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// יוצא מ-services, יוצא מ-server, נכנס ל-client/public/uploads
const UPLOADS_DIR = path.join(__dirname, '../../client/public/uploads');

// יצירת התיקייה אם לא קיימת
if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let connection = null;

const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

// ==========================================
// === 🧹 המטאטא: ניקוי הודעות זבל ===
// ==========================================
const cleanEmailBody = (text) => {
    if (!text) return "";
    
    const lines = text.split('\n');
    let cleanLines = [];

    for (let line of lines) {
        const l = line.trim();
        
        // עצירה ברגע שמזהים ציטוט של היסטוריה
        if (l.match(/On .* wrote:/i) || 
            l.match(/בתאריך .* כתב:/) || 
            l.match(/From: .*$/i) || 
            l.startsWith('__________') || // קו מפריד
            l.startsWith('>')) { 
            break; 
        }

        // סינון חתימות נפוצות (אפשר להוסיף עוד לפי הצורך)
        if (l === 'Sent from my iPhone' || l === 'נשלח מה-iPhone שלי') continue;
        
        cleanLines.push(line);
    }

    return cleanLines.join('\n').trim();
};

// ==========================================
// === 🔌 חיבור והאזנה ===
// ==========================================

export const startEmailListener = async () => {
    try {
        console.log("🔌 מתחבר ל-Gmail IMAP...");
        connection = await imap.connect(config);
        console.log("✅ מחובר! מאזין למיילים...");

        await connection.openBox('INBOX');
        
        // בדיקה ראשונית
        await checkForNewEmails();
        
        // בדיקה מחזורית כל 10 שניות
        setInterval(checkForNewEmails, 10000);

        // טיפול בניתוק בלתי צפוי מה-IMAP
        connection.on('error', (err) => {
            console.error('IMAP Connection Error:', err);
        });

    } catch (err) {
        console.error("❌ שגיאת IMAP (חיבור נכשל):", err.message);
        setTimeout(startEmailListener, 30000); // נסה שוב בעוד 30 שניות
    }
};

const checkForNewEmails = async () => {
    try {
        if (!connection) return;

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true, struct: true };

        const messages = await connection.search(searchCriteria, fetchOptions);
        if (messages.length === 0) return;

        for (const item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";
            const parsed = await simpleParser(idHeader + all.body);
            
            const fromEmail = parsed.from.value[0].address;
            const fromName = parsed.from.value[0].name || fromEmail.split('@')[0];
            const subject = parsed.subject || '';

            // --- הפעלת הניקוי האגרסיבי (המטאטא) ---
            // במקום לקחת את הטקסט המלא, אנחנו מנקים אותו
            let content = cleanEmailBody(parsed.text);

            // ---------------------------------------------------------
            // תרחיש א': גשר מייל -> וואטסאפ (Bridge Logic)
            // ---------------------------------------------------------
            const TARGET_EMAIL = process.env.TARGET_EMAIL_FOR_WHATSAPP; 
            
            if ((fromEmail === TARGET_EMAIL || fromEmail === process.env.EMAIL_USER) && subject.includes('WA_MSG:')) {
                
                console.log(`🔄 BRIDGE: זוהה מייל להעברה לוואצפ: ${subject}`);
                
                // חילוץ מספר הטלפון מהנושא (לוקח את המספר הראשון שמופיע אחרי WA_MSG)
                // זה יעבוד גם אם יש תאריך אחרי זה, כי הוא לוקח רק את המספרים והפלוס
                const match = subject.match(/WA_MSG:\s*([0-9\-\+]+)/);
                
                if (match && match[1]) {
                    const phoneNumber = match[1].trim();
                    const remoteJid = `${phoneNumber}@s.whatsapp.net`;

                    // בדיקת בטיחות
                    if (!sock) {
                        console.error('❌ שגיאה: מנסה לשלוח לוואטסאפ אך אין חיבור פעיל');
                        continue; 
                    }

                    // 1. שליחת טקסט נקי
                    if (content) {
                        await sock.sendMessage(remoteJid, { text: content });
                        console.log(`📤 נשלחה תשובה נקייה ל-${phoneNumber}`);
                    }

                    // 2. שליחת קבצים מצורפים מהמייל לוואטסאפ
                    if (parsed.attachments && parsed.attachments.length > 0) {
                        for (const attachment of parsed.attachments) {
                            
                            let msgPayload = {};

                            if (attachment.contentType.startsWith('image/')) {
                                msgPayload = { 
                                    image: attachment.content,
                                    caption: attachment.filename 
                                };
                            } else if (attachment.contentType.startsWith('video/')) {
                                msgPayload = { 
                                    video: attachment.content,
                                    caption: attachment.filename
                                };
                            } else if (attachment.contentType.startsWith('audio/')) {
                                // תמיכה בהחזרת הקלטות (PTT)
                                msgPayload = { 
                                    audio: attachment.content, 
                                    mimetype: 'audio/mp4', // בד"כ עובד טוב עם Baileys
                                    ptt: true 
                                };
                            } else {
                                // מסמכים וקבצים אחרים
                                msgPayload = { 
                                    document: attachment.content,
                                    mimetype: attachment.contentType,
                                    fileName: attachment.filename
                                };
                            }

                            await sock.sendMessage(remoteJid, msgPayload);
                            console.log(`📤 נשלח קובץ (${attachment.contentType}) ל-${phoneNumber}`);
                        }
                    }
                }
                // סיימנו עם המייל הזה, עוברים להבא
                continue; 
            }

            // ---------------------------------------------------------
            // תרחיש ב': הודעת מערכת רגילה (Tickets / CRM)
            // ---------------------------------------------------------
            const ticketMatch = subject.match(/#(\d+)/);
            if (!ticketMatch) {
                continue; 
            }

            const ticketId = ticketMatch[1];

            // --- שמירת קבצים לתיקיית הקליינט ---
            let fileUrl = null;
            let fileType = 'text';

            if (parsed.attachments && parsed.attachments.length > 0) {
                const attachment = parsed.attachments[0]; 
                const fileName = `${Date.now()}-${attachment.filename.replace(/\s+/g, '_')}`;
                const savePath = path.join(UPLOADS_DIR, fileName);
                
                fs.writeFileSync(savePath, attachment.content);
                
                fileUrl = `/uploads/${fileName}`;

                if (attachment.contentType.startsWith('image/')) fileType = 'image';
                else if (attachment.contentType.startsWith('video/')) fileType = 'video';
                else fileType = 'file';
            }

            console.log(`📥 הודעה חדשה לטיקט ${ticketId}.`);

            // שימוש בתוכן המלא כאן (לא נקי) כי ב-CRM לפעמים רוצים לראות הכל,
            // אבל אם אתה מעדיף נקי גם כאן - תשנה ל-content
            await Message.create({
                ticketId,
                sender: 'client',
                clientEmail: fromEmail,
                clientName: fromName,
                content: parsed.text, // כאן השארתי את המקור, לשיקולך
                type: fileType,
                fileUrl: fileUrl,
                isRead: false
            });

            await Contact.updateOne(
                { email: fromEmail }, 
                { $set: { lastActive: new Date(), name: fromName } }, 
                { upsert: true }
            );
        }
    } catch (err) {
        console.error("❌ שגיאה ב-Listener:", err.message);
        if (err.message.includes('Socket') || err.message.includes('Ended')) {
            setTimeout(startEmailListener, 5000);
        }
    }
};