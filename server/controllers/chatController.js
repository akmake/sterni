import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import { sendOpsEmail, formatEmailHtml } from '../services/emailService.js';
import { sock, isConnected, sendMessageHuman } from '../services/whatsappService.js';
import AppError from '../utils/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
            source: 'web',
            isRead: true
        });

        // 3. לוגיקת שליחה (Routing) - וואצפ ומייל

        // --- אופציה א': שליחה בוואצפ (עם התנהגות אנושית) ---
        if (contact.phone && isConnected()) {
            const jid = `${contact.phone}@s.whatsapp.net`;
            try {
                if (fileUrl) {
                    const fullPath = path.join(UPLOADS_PATH, fileUrl);

                    if (fs.existsSync(fullPath)) {
                        const fileBuffer = fs.readFileSync(fullPath);
                        const ext = path.extname(fileUrl).toLowerCase();
                        const isImage = type === 'image' || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                        const isVideo = type === 'video' || ['.mp4', '.avi', '.mov'].includes(ext);

                        if (isImage) {
                            await sendMessageHuman(jid, { image: fileBuffer, caption: content }, content);
                        } else if (isVideo) {
                            await sendMessageHuman(jid, { video: fileBuffer, caption: content }, content);
                        } else {
                            // זיהוי mimetype דינמי
                            const mimeTypes = {
                                '.pdf': 'application/pdf',
                                '.doc': 'application/msword',
                                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                '.xls': 'application/vnd.ms-excel',
                                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                '.zip': 'application/zip',
                                '.txt': 'text/plain',
                            };
                            const mimetype = mimeTypes[ext] || 'application/octet-stream';

                            await sendMessageHuman(jid, {
                                document: fileBuffer,
                                mimetype,
                                fileName: path.basename(fileUrl)
                            });
                        }
                        console.log(`📤 נשלח קובץ בוואצפ ל-${contact.phone}`);
                    } else {
                        await sendMessageHuman(jid, { text: `${content}\n\n(קובץ מצורף חסר בשרת)` }, content);
                    }
                } else {
                    await sendMessageHuman(jid, { text: content }, content);
                }
            } catch (waError) {
                console.error('❌ שגיאה בשליחה לוואצפ:', waError.message);
                // ממשיכים — המייל עדיין יישלח כגיבוי
            }
        } else if (contact.phone && !isConnected()) {
            console.warn(`⚠️ וואצאפ לא מחובר — ההודעה ל-${contact.phone} תישלח רק במייל`);
        }

        // --- אופציה ב': שליחה במייל (תמיד, כגיבוי) ---
        if (clientEmail) {
            let emailHtml = formatEmailHtml(content);

            if (fileUrl) {
                emailHtml += `<br><br><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}${fileUrl}">לחץ לצפייה בקובץ המצורף</a>`;
            }

            await sendOpsEmail(
                clientEmail,
                `Re: פנייה #${ticketId}`,
                emailHtml
            );

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
        const messages = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: "$ticketId",
                lastMessage: { $first: "$$ROOT" },
                clientEmail: { $first: "$clientEmail" }
            }}
        ]);

        const enrichedConversations = await Promise.all(messages.map(async (conv) => {
            const contact = await Contact.findOne({ email: conv.clientEmail });
            return {
                ticketId: conv._id,
                from: conv.clientEmail,
                clientName: contact ? contact.name : conv.clientEmail,
                clientPhone: contact ? contact.phone : '',
                subject: conv.lastMessage.content ? conv.lastMessage.content.substring(0, 30) : 'קובץ מצורף',
                createdAt: conv.lastMessage.createdAt,
                lastMessage: conv.lastMessage
            };
        }));

        res.status(200).json(enrichedConversations);

    } catch (error) {
        next(new AppError(error.message, 500));
    }
};