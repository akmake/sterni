// services/emailListener.js
import { ImapFlow } from 'imapflow'; // ✅ תוקן: בלי מקף
import { simpleParser } from 'mailparser';
import Email from '../models/Email.js'; // ✅ הוספנו: ייבוא המודל לשמירה ב-DB

const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: false 
});

export const startEmailListener = async () => {
    try {
        console.log('🔌 Connecting to IMAP...');
        await client.connect();
        console.log('✅ IMAP Connected - Listening for emails...');

        let lock = await client.getMailboxLock('INBOX');

        try {
            client.on('exists', async (data) => {
                // בדיקה אם נוסף מייל חדש
                if (data.count > data.prevCount) {
                    console.log(`📨 New email detected! (#${data.count})`);
                    
                    try {
                        // משיכת המייל
                        const message = await client.fetchOne(data.count, { source: true });
                        const parsed = await simpleParser(message.source);
                        
                        // חילוץ פרטי השולח בצורה נקייה
                        const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || 'Unknown';
                        const fromAddress = parsed.from?.value?.[0]?.address || 'Unknown';

                        console.log(`📥 Saving email from: ${fromName}`);

                        // ✅ שמירה במסד הנתונים
                        await Email.create({
                            fromName: fromName,
                            fromAddress: fromAddress,
                            subject: parsed.subject,
                            body: parsed.text || parsed.html || '(No Content)',
                            status: 'new'
                        });
                        
                        console.log('✅ Email saved to DB successfully');

                    } catch (err) {
                        console.error('❌ Error processing/saving email:', err);
                    }
                }
            });

            await client.idle();
            
        } finally {
            lock.release();
        }

    } catch (err) {
        console.error('❌ IMAP Connection Error:', err.message);
        setTimeout(startEmailListener, 5000);
    }
};