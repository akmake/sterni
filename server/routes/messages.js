import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import Message from '../models/Message.js';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'YOUR_EMAIL@gmail.com', 
    pass: 'YOUR_APP_PASSWORD' 
  }
});

// שליחת הודעה (מבוסס כתובת מייל)
router.post('/send', upload.array('files'), async (req, res) => {
  try {
    const { toEmail, subject, content, groupId } = req.body;
    
    if (!toEmail) return res.status(400).json({ message: 'כתובת מייל יעד חסרה' });

    const mailAttachments = req.files.map(f => ({
        filename: f.originalname,
        path: f.path
    }));

    // שליחה במייל
    await transporter.sendMail({
      from: '"מערכת ניהול" <YOUR_EMAIL@gmail.com>',
      to: toEmail,
      subject: subject,
      text: content,
      attachments: mailAttachments
    });

    // שמירה ב-DB לפי remoteEmail
    const newMessage = new Message({
      remoteEmail: toEmail.toLowerCase(),
      groupId: groupId || null, // אם שלחת מדף קבוצה זה יישמר, אם מהאינבוקס הכללי - לא.
      subject: subject,
      content: content,
      direction: 'outbound',
      attachments: req.files.map(f => ({
        fileName: f.originalname,
        filePath: f.path.replace(/\\/g, '/'),
        fileType: f.mimetype
      }))
    });

    await newMessage.save();
    res.json(newMessage);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'שגיאה בשליחת ההודעה' });
  }
});

// קבלת שיחה לפי אימייל (בשביל ה-Inbox הכללי)
router.get('/conversation/:email', async (req, res) => {
    try {
        const messages = await Message.find({ 
            remoteEmail: req.params.email.toLowerCase() 
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

// קבלת רשימת כל השיחות (Inbox)
router.get('/inbox/list', async (req, res) => {
    try {
        const conversations = await Message.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: "$remoteEmail",
                lastMessageTime: { $first: "$createdAt" },
                lastSubject: { $first: "$subject" },
                lastSnippet: { $first: "$content" },
                unreadCount: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } }
            }},
            { $sort: { lastMessageTime: -1 } }
        ]);
        res.json(conversations);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch inbox' });
    }
});

export default router;