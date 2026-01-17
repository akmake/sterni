import crypto from 'crypto';

// מפתח הצפנה ראשי - זה הדבר היחיד שחייב להישאר קבוע בקוד או ב-.env
// אם אתה משנה את המפתח הזה - כל הסיסמאות ב-DB לא יהיו ניתנות לפענוח!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3'; // 32 chars
const ALGORITHM = 'aes-256-cbc';

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
};

export const decrypt = (hash) => {
  const iv = Buffer.from(hash.iv, 'hex');
  const encryptedText = Buffer.from(hash.content, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};