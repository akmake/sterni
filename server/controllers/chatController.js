import { Message } from '../models/Message.js';
import { Contact } from '../models/Contact.js'; // הייבוא החדש
import { transporter, formatEmailHtml } from '../services/emailService.js';

// --- שליחת הודעה (עם יצירה אוטומטית של איש קשר) ---
export const sendMessageToClient = async (req, res) => {
  try {
    const { ticketId, clientEmail, content, type, fileUrl, clientName, clientPhone } = req.body;

    // 1. שמירה/עדכון של איש הקשר
    // אם המייל לא קיים, ניצור איש קשר חדש. אם קיים, נעדכן זמן פעילות אחרון.
    let contact = await Contact.findOne({ email: clientEmail });
    if (!contact) {
        contact = await Contact.create({
            name: clientName || clientEmail.split('@')[0],
            email: clientEmail,
            phone: clientPhone || ''
        });
    } else {
        contact.lastActive = new Date();
        await contact.save();
    }

    // 2. שמירת ההודעה
    const newMessage = await Message.create({
      ticketId,
      sender: 'me',
      clientEmail,
      content,
      type,
      fileUrl,
      isRead: true
    });

    // 3. שליחת המייל
    const mailOptions = {
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: `Re: פנייה #${ticketId}`, // או נושא מותאם אישית
      html: formatEmailHtml(content),
    };

    if (fileUrl) {
        mailOptions.html += `<br><a href="${fileUrl}">לחץ לצפייה בקובץ המצורף</a>`;
    }

    await transporter.sendMail(mailOptions);

    res.status(201).json({ status: 'success', data: newMessage, contact });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// --- קבלת רשימת שיחות (משולב: הודעות אחרונות + אנשי קשר) ---
export const getConversations = async (req, res) => {
    try {
        // 1. נשלוף את כל ההודעות כדי לקבץ לפי ticketId
        const messages = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: "$ticketId",
                lastMessage: { $first: "$$ROOT" },
                clientEmail: { $first: "$clientEmail" }
            }}
        ]);

        // 2. נשלוף את פרטי אנשי הקשר המלאים עבור כל שיחה
        // זה מבטיח שאם שיניתי שם ללקוח, אראה את השם ולא רק את המייל
        const enrichedConversations = await Promise.all(messages.map(async (conv) => {
            const contact = await Contact.findOne({ email: conv.clientEmail });
            return {
                ticketId: conv._id,
                from: conv.clientEmail,
                clientName: contact ? contact.name : conv.clientEmail,
                clientPhone: contact ? contact.phone : '',
                subject: conv.lastMessage.content.substring(0, 30), // תצוגה מקדימה
                createdAt: conv.lastMessage.createdAt,
                lastMessage: conv.lastMessage
            };
        }));

        res.json(enrichedConversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};