import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// מפתח הצפנה ראשי — חובה להגדיר ENCRYPTION_KEY (32 תווים) ב-.env.
// אין מפתח ברירת-מחדל: הצפנה ללא מפתח מוגדר תיכשל בקול רם ולא בשקט.
// ⚠️ אם תשנה את המפתח — סיסמאות שהוצפנו עם המפתח הקודם לא יהיו ניתנות לפענוח.
const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be set to a 32-character secret in .env');
  }
  return Buffer.from(key);
};

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
};

export const decrypt = (hash) => {
  const iv = Buffer.from(hash.iv, 'hex');
  const encryptedText = Buffer.from(hash.content, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};