import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sock } from './whatsappService.js';
import SystemConfig from '../models/SystemConfig.js';
import EmailAccount from '../models/EmailAccount.js';
import { decrypt } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../client/public/uploads');

if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let connection = null;

const getImapConfig = async () => {
    const sysConfig = await SystemConfig.findOne();
    if (!sysConfig?.opsEmailId) throw new Error("לא הוגדר מייל תפעול ב-DB");
    
    const account = await EmailAccount.findById(sysConfig.opsEmailId);
    if (!account) throw new Error("חשבון המייל לא נמצא");

    const password = decrypt({ content: account.encryptedPassword, iv: account.iv });
    const host = account.host === 'smtp.gmail.com' ? 'imap.gmail.com' : account.host;

    return {
        imap: {
            user: account.user,
            password: password,
            host: host,
            port: 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        },
        systemEmail: account.user 
    };
};

// ==========================================
// === 🧹 המטאטא ===
// ==========================================
const cleanEmailBody = (text) => {
    if (!text) return "";
    
    const lines = text.split(/\r?\n/);
    const cleanLines = [];

    for (let line of lines) {
        let trimmed = line.trim(); 
        
        // לוגיקת הניקוי הקיימת
        if (trimmed.includes("On ") && trimmed.includes(" at ") && (trimmed.includes("wrote") || trimmed.includes("<"))) break; 
        if (/^On .* wrote:$/i.test(trimmed)) break;
        if (trimmed.includes("בתאריך") && trimmed.includes("מאת")) break;
        if (/^From:\s/i.test(trimmed)) break;
        if (/^_{3,}/.test(trimmed)) break;
        if (/^-{3,}/.test(trimmed)) break;
        if (trimmed.startsWith('>')) break;
        if (trimmed.includes("Sent from my iPhone")) continue;
        if (trimmed.includes("נשלח מה-iPhone שלי")) continue;

        cleanLines.push(line);
    }

    return cleanLines.join('\n').trim();
};

export const startEmailListener = async () => {
    try {
        console.log("🔌 טוען הגדרות ומתחבר ל-IMAP...");
        const config = await getImapConfig(); 
        
        connection = await imap.connect(config);
        console.log("✅ מחובר! מאזין למיילים...");

        await connection.openBox('INBOX');
        
        await checkForNewEmails(config.systemEmail);
        setInterval(() => checkForNewEmails(config.systemEmail), 10000);

        connection.on('error', (err) => {
            console.error('IMAP Connection Error:', err);
            setTimeout(startEmailListener, 10000);
        });

    } catch (err) {
        console.error("❌ שגיאת IMAP (חיבור נכשל):", err.message);
        setTimeout(startEmailListener, 30000); 
    }
};

const checkForNewEmails = async (systemEmail) => {
    try {
        if (!connection) return;

        // markSeen: false (לא לסמן כנקרא עד שלא נשלח בהצלחה!)
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: false, struct: true };

        const messages = await connection.search(searchCriteria, fetchOptions);
        if (messages.length === 0) return;

        const sysConfig = await SystemConfig.findOne();
        const TARGET_EMAIL = sysConfig?.targetWhatsAppEmail;

        for (const item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;
            const idHeader = "Imap-Id: " + id + "\r\n";
            const parsed = await simpleParser(idHeader + all.body);
            
            const fromEmail = parsed.from.value[0].address;
            const fromName = parsed.from.value[0].name || fromEmail.split('@')[0];
            const subject = parsed.subject || '';
            
            const cleanContent = cleanEmailBody(parsed.text);
            let shouldMarkAsSeen = false;

            // =========================================================
            // לוגיקת הגשר (BRIDGE) + דיבוג מטורף
            // =========================================================
            if ((fromEmail === TARGET_EMAIL || fromEmail === systemEmail) && subject.includes('WA_MSG:')) {
                
                console.log(`\n================= 🔍 DEBUG START =================`);
                console.log(`📧 נושא: ${subject}`);
                console.log(`📧 מאת: ${fromEmail}`);
                console.log(`📝 תוכן גולמי (RAW) לפני ניקוי:`);
                // JSON.stringify יראה לנו בדיוק איפה יש \n ואיפה יש תווים נסתרים
                console.log(JSON.stringify(parsed.text)); 
                console.log(`--------------------------------------------------`);
                console.log(`🧹 תוכן אחרי ניקוי:`);
                console.log(JSON.stringify(cleanContent));
                console.log(`================= 🔍 DEBUG END ===================\n`);

                if (!sock || !sock.user) {
                    console.warn(`⏳ וואצאפ לא מחובר, מדלג...`);
                    continue; 
                }

                const match = subject.match(/WA_MSG:\s*([0-9\-\+]+)/);
                if (match && match[1]) {
                    const phoneNumber = match[1].trim();
                    const remoteJid = `${phoneNumber}@s.whatsapp.net`;

                    try {
                        if (cleanContent && cleanContent.length > 0) {
                            await sock.sendMessage(remoteJid, { text: cleanContent });
                            console.log(`📤 נשלחה תשובה ל-${phoneNumber}`);
                        } else {
                            console.log(`⚠️ התוכן ריק אחרי ניקוי (אולי נשלח רק קובץ?)`);
                        }

                        if (parsed.attachments && parsed.attachments.length > 0) {
                            for (const attachment of parsed.attachments) {
                                let msgPayload = {};
                                if (attachment.contentType.startsWith('image/')) msgPayload = { image: attachment.content, caption: attachment.filename };
                                else if (attachment.contentType.startsWith('video/')) msgPayload = { video: attachment.content, caption: attachment.filename };
                                else if (attachment.contentType.startsWith('audio/')) msgPayload = { audio: attachment.content, mimetype: 'audio/mp4', ptt: true };
                                else msgPayload = { document: attachment.content, mimetype: attachment.contentType, fileName: attachment.filename };
                                await sock.sendMessage(remoteJid, msgPayload);
                            }
                        }
                        
                        shouldMarkAsSeen = true;

                    } catch (waError) {
                        console.error(`❌ שגיאה בשליחה לוואצאפ:`, waError.message);
                    }
                } else {
                     shouldMarkAsSeen = true;
                }
            } 
            // =========================================================
            // לוגיקת CRM (ללא שינוי)
            // =========================================================
            else {
                const ticketMatch = subject.match(/#(\d+)/);
                if (ticketMatch) {
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

                    await Message.create({
                        ticketId, sender: 'client', clientEmail: fromEmail, clientName: fromName,
                        content: parsed.text, type: fileType, fileUrl: fileUrl, isRead: false
                    });

                    await Contact.updateOne(
                        { email: fromEmail }, { $set: { lastActive: new Date(), name: fromName } }, { upsert: true }
                    );
                }
                shouldMarkAsSeen = true; 
            }

            if (shouldMarkAsSeen) {
                await connection.addFlags(item.attributes.uid, ['\\Seen'], (err) => {
                    if (err) console.error('Error marking as seen:', err);
                });
            }
        }
    } catch (err) {
        console.error("❌ שגיאה ב-Listener:", err.message);
        if (err.message.includes('Socket') || err.message.includes('Ended')) {
            setTimeout(startEmailListener, 5000);
        }
    }
};