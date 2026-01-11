import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

export const startEmailListener = async () => {
    try {
        console.log("🔌 מתחבר ל-Gmail IMAP...");
        connection = await imap.connect(config);
        console.log("✅ מחובר! שומר קבצים ב:", UPLOADS_DIR);

        await connection.openBox('INBOX');
        await checkForNewEmails();
        setInterval(checkForNewEmails, 10000);

    } catch (err) {
        console.error("❌ שגיאת IMAP:", err.message);
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
            
            // זיהוי Ticket ID
            const subject = parsed.subject;
            const match = subject ? subject.match(/#(\d+)/) : null;
            if (!match) continue;

            const ticketId = match[1];
            const fromEmail = parsed.from.value[0].address;
            const fromName = parsed.from.value[0].name || fromEmail.split('@')[0];

            // ניקוי טקסט
            let content = parsed.text || "";
            content = content.split(/On .* wrote:/)[0];
            content = content.split(/בתאריך .* כתב:/)[0];
            content = content.trim();

            // --- שמירת קבצים לתיקיית הקליינט ---
            let fileUrl = null;
            let fileType = 'text';

            if (parsed.attachments && parsed.attachments.length > 0) {
                const attachment = parsed.attachments[0];
                const fileName = `${Date.now()}-${attachment.filename.replace(/\s+/g, '_')}`; // שם קובץ נקי
                const savePath = path.join(UPLOADS_DIR, fileName);
                
                fs.writeFileSync(savePath, attachment.content);
                
                // ה-URL הוא יחסי לתיקיית public בקליינט
                fileUrl = `/uploads/${fileName}`;

                if (attachment.contentType.startsWith('image/')) fileType = 'image';
                else if (attachment.contentType.startsWith('video/')) fileType = 'video';
                else fileType = 'file';
            }

            console.log(`📥 הודעה חדשה ל-${ticketId}. קובץ: ${fileUrl || 'אין'}`);

            // שמירה ב-DB
            await Message.create({
                ticketId,
                sender: 'client',
                clientEmail: fromEmail,
                clientName: fromName,
                content: content,
                type: fileType,
                fileUrl: fileUrl,
                isRead: false
            });

            // עדכון איש קשר
            await Contact.updateOne(
                { email: fromEmail }, 
                { $set: { lastActive: new Date(), name: fromName } }, 
                { upsert: true }
            );
        }
    } catch (err) {
        console.error("❌ שגיאה:", err.message);
        if (err.message.includes('Socket') || err.message.includes('Ended')) startEmailListener();
    }
};