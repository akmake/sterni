import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isConnected, sendMessageHuman } from './whatsappService.js';
import SystemConfig from '../models/SystemConfig.js';
import EmailAccount from '../models/EmailAccount.js';
import { decrypt } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../client/public/uploads');

// מונע עיבוד כפול של מיילים — שומר UID של מיילים שכבר בטיפול
const processingEmails = new Set();

if (!fs.existsSync(UPLOADS_DIR)){
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let connection = null;
let healthCheckInterval = null;

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
const SIGNATURE_ANCHORS = [
    /טלפון[\s:]*[\d\-\+]/,
    /נייד[\s:]*[\d\-\+]/,
    /פקס[\s:]*[\d\-\+]/,
    /tel[\s.:]*[\d\-\+]/i,
    /phone[\s.:]*[\d\-\+]/i,
    /mobile[\s.:]*[\d\-\+]/i,
    /בע"מ/,
    /ושות'/,
];

const cleanEmailBody = (text) => {
    if (!text) return "";

    const lines = text.split(/\r?\n/);
    let bodyLines = [];

    // Step 1: Strip reply chains
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes("On ") && trimmed.includes(" at ") && (trimmed.includes("wrote") || trimmed.includes("<"))) break;
        if (/^On .* wrote:$/i.test(trimmed)) break;
        if (trimmed.includes("בתאריך") && trimmed.includes("מאת")) break;
        if (/^From:\s/i.test(trimmed)) break;
        if (/^_{3,}/.test(trimmed)) break;
        if (/^-{3,}/.test(trimmed)) break;
        if (trimmed.startsWith('>')) break;
        if (trimmed.includes("Sent from my iPhone")) continue;
        if (trimmed.includes("נשלח מה-iPhone שלי")) continue;
        bodyLines.push(line);
    }

    // Step 2: RFC 2822 signature separator "-- "
    const sepIdx = bodyLines.findIndex(l => /^--\s*$/.test(l.trim()));
    if (sepIdx !== -1) {
        return bodyLines.slice(0, sepIdx).join('\n').trim();
    }

    // Step 3: Anchor-based paragraph signature detection
    const isAnchor = (line) => SIGNATURE_ANCHORS.some(p => p.test(line));
    const isShort = (line) => line.trim().length <= 45;

    const paragraphs = [];
    let current = [];
    for (const line of bodyLines) {
        if (line.trim() === '') {
            if (current.length > 0) { paragraphs.push(current); current = []; }
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) paragraphs.push(current);

    let anchorParaIdx = -1;
    for (let i = paragraphs.length - 1; i >= 0; i--) {
        if (paragraphs[i].some(l => isAnchor(l))) { anchorParaIdx = i; break; }
    }

    if (anchorParaIdx !== -1) {
        const tailAllShort = paragraphs.slice(anchorParaIdx).every(p => p.every(l => isShort(l)));
        if (tailAllShort) {
            let sigParaStart = anchorParaIdx;
            let count = 0;
            for (let i = anchorParaIdx - 1; i >= 0 && count < 3; i--) {
                if (paragraphs[i].every(l => isShort(l))) { sigParaStart = i; count++; }
                else break;
            }
            const kept = paragraphs.slice(0, sigParaStart);
            bodyLines = kept.flatMap((p, i) => i < kept.length - 1 ? [...p, ''] : p);
        }
    }

    return bodyLines.join('\n').trim();
};

export const startEmailListener = async () => {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }

    try {
        console.log("🔌 טוען הגדרות ומתחבר ל-IMAP...");
        const config = await getImapConfig();

        connection = await imap.connect(config);
        console.log("✅ מחובר! מאזין למיילים...");

        await connection.openBox('INBOX');

        await checkForNewEmails(config.systemEmail);

        const emailInterval = setInterval(() => checkForNewEmails(config.systemEmail), 10000);

        healthCheckInterval = setInterval(async () => {
            try {
                if (!connection || connection.imap.state === 'disconnected') {
                    console.warn('⚠️ IMAP health check: חיבור מת, מתחבר מחדש...');
                    clearInterval(emailInterval);
                    clearInterval(healthCheckInterval);
                    healthCheckInterval = null;
                    connection = null;
                    setTimeout(startEmailListener, 1000);
                }
            } catch (err) {
                console.error('Health check error:', err.message);
            }
        }, 5 * 60 * 1000);

        connection.on('error', (err) => {
            console.error('IMAP Connection Error:', err);
            clearInterval(emailInterval);
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

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: false, struct: true };

        const messages = await connection.search(searchCriteria, fetchOptions);
        if (messages.length === 0) return;

        const sysConfig = await SystemConfig.findOne();
        const TARGET_EMAIL = sysConfig?.targetWhatsAppEmail;

        for (const item of messages) {
            const all = item.parts.find(part => part.which === '');
            const id = item.attributes.uid;

            // דילוג על מיילים שכבר בטיפול (מונע שליחה כפולה לוואצאפ)
            if (processingEmails.has(id)) {
                continue;
            }
            processingEmails.add(id);

            const idHeader = "Imap-Id: " + id + "\r\n";
            const parsed = await simpleParser(idHeader + all.body);

            const fromEmail = parsed.from.value[0].address;
            const fromName = parsed.from.value[0].name || fromEmail.split('@')[0];
            const subject = parsed.subject || '';

            const cleanContent = cleanEmailBody(parsed.text);
            let shouldMarkAsSeen = false;

            // =========================================================
            // לוגיקת הגשר (BRIDGE) — מייל → וואצאפ
            // =========================================================
            if ((fromEmail === TARGET_EMAIL || fromEmail === systemEmail) && subject.includes('WA_MSG:')) {

                // ★ שימוש ב-isConnected() במקום בדיקה ישירה של sock
                if (!isConnected()) {
                    console.warn(`⏳ וואצאפ לא מחובר, לא מסמנים כנקרא — ננסה שוב בסבב הבא`);
                    continue; // לא מסמנים כ-seen — ננסה שוב ב-10 שניות
                }

                const match = subject.match(/WA_MSG:\s*([0-9\-\+]+)/);
                if (match && match[1]) {
                    const phoneNumber = match[1].trim();
                    const remoteJid = `${phoneNumber}@s.whatsapp.net`;

                    try {
                        // שליחת טקסט עם התנהגות אנושית
                        if (cleanContent && cleanContent.length > 0) {
                            await sendMessageHuman(remoteJid, { text: cleanContent }, cleanContent);
                        } else {
                            console.warn(`⚠️ תוכן ריק אחרי ניקוי ל-${phoneNumber}`);
                        }

                        // שליחת קבצים מצורפים
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
                                    msgPayload = { document: attachment.content, mimetype: attachment.contentType, fileName: attachment.filename };
                                }

                                await sendMessageHuman(remoteJid, msgPayload);
                            }
                        }

                        shouldMarkAsSeen = true;

                    } catch (waError) {
                        console.error(`❌ שגיאה בשליחה לוואצאפ:`, waError.message);
                        // לא מסמנים כנקרא — ננסה שוב
                    }
                } else {
                     shouldMarkAsSeen = true;
                }
            }
            // =========================================================
            // לוגיקת CRM — מיילים רגילים
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
                processingEmails.delete(id); // סיימנו — מוחקים מהסט
            }
        }
    } catch (err) {
        console.error("❌ שגיאה ב-Listener:", err.message);
        if (err.message.includes('Socket') || err.message.includes('Ended')) {
            setTimeout(startEmailListener, 5000);
        }
    }
};