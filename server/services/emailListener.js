import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// ייבוא הסוקט בצורה שתתעדכן בזמן אמת
import { sock } from './whatsappService.js';

// --- הגדרת נתיב השמירה בתוך ה-CLIENT ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../client/public/uploads');

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
// === 🧹 המטאטא: ניקוי כירורגי ===
// ==========================================
const cleanEmailBody = (text) => {
    if (!text) return "";
    
    const lines = text.split(/\r?\n/); // מפצל שורות (כולל תמיכה ב-Windows/Linux)
    const cleanLines = [];

    for (let line of lines) {
        // מנקה רווחים לבדיקה, אבל שומר על המקורי להדפסה
        const trimmed = line.trim(); 

        // 1. זיהוי שורת "בתאריך ... מאת ..." (כולל תווים נסתרים!)
        // ה-Regex הזה תופס גם אם יש תווי כיוון (‫) לפני המילה "בתאריך"
        if (/[‫\u200f\u202a-\u202e]*בתאריך.+מאת.+/.test(trimmed)) {
            break; // עוצר הכל ברגע שמצאנו את השורה הזאת
        }

        // 2. זיהוי אנגלית (On ... wrote:)
        if (/^On .* wrote:$/i.test(trimmed)) break;

        // 3. זיהוי Outlook/אחרים (From: ...)
        if (/^From:\s/i.test(trimmed)) break;

        // 4. קווים מפרידים (___ או ---)
        if (/^_{3,}/.test(trimmed)) break;
        if (/^-{3,}/.test(trimmed)) break;

        // 5. ציטוטים (שורות שמתחילות ב->)
        if (trimmed.startsWith('>')) break;

        // 6. חתימות נפוצות באייפון
        if (/^Sent from my iPhone/i.test(trimmed)) continue;
        if (/^נשלח מה-iPhone שלי/.test(trimmed)) continue;

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
        
        await checkForNewEmails();
        setInterval(checkForNewEmails, 10000);

        connection.on('error', (err) => {
            console.error('IMAP Connection Error:', err);
        });

    } catch (err) {
        console.error("❌ שגיאת IMAP (חיבור נכשל):", err.message);
        setTimeout(startEmailListener, 30000); 
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

            // --- כאן אנחנו מנקים את המייל ---
            const cleanContent = cleanEmailBody(parsed.text);

            // =========================================================
            // תרחיש א': גשר מייל -> וואטסאפ (Bridge Logic)
            // =========================================================
            const TARGET_EMAIL = process.env.TARGET_EMAIL_FOR_WHATSAPP; 
            
            if ((fromEmail === TARGET_EMAIL || fromEmail === process.env.EMAIL_USER) && subject.includes('WA_MSG:')) {
                
                console.log(`🔄 BRIDGE: זוהה מייל להעברה לוואצפ: ${subject}`);
                
                const match = subject.match(/WA_MSG:\s*([0-9\-\+]+)/);
                
                if (match && match[1]) {
                    const phoneNumber = match[1].trim();
                    const remoteJid = `${phoneNumber}@s.whatsapp.net`;

                    if (!sock) {
                        console.error('❌ שגיאה: מנסה לשלוח לוואטסאפ אך אין חיבור פעיל');
                        continue; 
                    }

                    // 1. שליחת טקסט נקי בלבד!
                    if (cleanContent) {
                        await sock.sendMessage(remoteJid, { text: cleanContent });
                        console.log(`📤 נשלחה תשובה נקייה ל-${phoneNumber}`);
                    }

                    // 2. שליחת קבצים
                    if (parsed.attachments && parsed.attachments.length > 0) {
                        for (const attachment of parsed.attachments) {
                            let msgPayload = {};

                            if (attachment.contentType.startsWith('image/')) {
                                msgPayload = { image: attachment.content, caption: attachment.filename };
                            } else if (attachment.contentType.startsWith('video/')) {
                                msgPayload = { video: attachment.content, caption: attachment.filename };
                            } else if (attachment.contentType.startsWith('audio/')) {
                                msgPayload = { audio: attachment.content, mimetype: 'audio/mp4', ptt: true };
                            } else {
                                msgPayload = { 
                                    document: attachment.content,
                                    mimetype: attachment.contentType,
                                    fileName: attachment.filename
                                };
                            }
                            await sock.sendMessage(remoteJid, msgPayload);
                        }
                    }
                }
                continue; 
            }

            // =========================================================
            // תרחיש ב': הודעת מערכת רגילה (Tickets / CRM)
            // =========================================================
            const ticketMatch = subject.match(/#(\d+)/);
            if (!ticketMatch) continue; 

            const ticketId = ticketMatch[1];
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

            // הערה: ב-CRM אנחנו בדרך כלל שומרים את המקור (parsed.text)
            // אבל אם גם שם אתה רוצה נקי, תחליף ל-cleanContent
            await Message.create({
                ticketId,
                sender: 'client',
                clientEmail: fromEmail,
                clientName: fromName,
                content: parsed.text, 
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