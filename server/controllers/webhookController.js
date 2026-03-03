import { Message } from '../models/Message.js';

export const handleIncomingEmail = async (req, res) => {
  try {
    // השדות תלויים בספק (SendGrid שולח שדות מסוימים, Mailgun אחרים).
    // מימוש זה מותאם לסטנדרט נפוץ של Multipart Form Data.
    
    const { subject, text, from, html } = req.body;
    const files = req.files; // מגיע מ-Multer

    // 1. חילוץ ה-Ticket ID מהנושא
    // מחפש תבנית של #ואחריו מספרים
    const ticketIdMatch = subject ? subject.match(/#(\d+)/) : null;
    
    if (!ticketIdMatch) {
      console.warn('No ticket ID found in subject. Skipping.');
      return res.status(200).send('OK'); // מחזירים 200 כדי שהספק לא ינסה לשלוח שוב
    }

    const ticketId = ticketIdMatch[1];

    // 2. ניקוי הטקסט (הסרת הציטוט של המייל הקודם)
    // זה פתרון בסיסי, קיימות ספריות כמו 'email-reply-parser' שעושות את זה מושלם.
    let cleanContent = text || '';
    if (cleanContent.includes('On')) {
        cleanContent = cleanContent.split(/On .* wrote:/)[0].trim();
    }
    // תמיכה בעברית "בתאריך..."
    if (cleanContent.includes('בתאריך')) {
        cleanContent = cleanContent.split(/בתאריך .* כתב:/)[0].trim();
    }

    // 3. טיפול בקבצים מצורפים מהמייל
    let fileUrl = null;
    let type = 'text';

    if (files && files.length > 0) {
      const file = files[0]; // לוקחים את הקובץ הראשון לצורך הדוגמה
      
      // כאן צריך להעלות את הקובץ ל-S3/Cloudinary ולקבל URL
      // לצורך הדוגמה נניח שיש לנו פונקציית עזר uploadToCloud
      // fileUrl = await uploadToCloud(file);
      
      fileUrl = "https://placeholder.com/file_from_email_simulation"; // זמני
      
      if (file.mimetype.startsWith('image/')) type = 'image';
      else if (file.mimetype.startsWith('video/')) type = 'video';
      else type = 'file';
    }

    // 4. שמירה ב-DB
    await Message.create({
      ticketId,
      sender: 'client',
      clientEmail: from, // לעיתים צריך לנקות את הסטרינג כדי לקבל רק אימייל נקי
      content: cleanContent,
      type,
      fileUrl,
      isRead: false
    });

    // כאן אפשר להוסיף Socket.io emit כדי לעדכן את הקליינט בזמן אמת

    res.status(200).send('Webhook received successfully');

  } catch (error) {
    console.error('Webhook error:', error);
    // חשוב להחזיר 500 רק אם זו תקלה אמיתית, אחרת הספק ינסה לשלוח שוב ושוב
    res.status(500).send('Error processing email');
  }
};