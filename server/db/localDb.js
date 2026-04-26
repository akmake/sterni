import mongoose from 'mongoose';

/**
 * חיבור נפרד ל-MongoDB לוקאלי — משמש כגיבוי אוטומטי לענן.
 * אם החיבור נכשל, האפליקציה ממשיכה לפעול רגיל (non-blocking).
 */

const LOCAL_URI = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/sterni';

const localConnection = mongoose.createConnection(LOCAL_URI, {
  serverSelectionTimeoutMS: 5000,
});

localConnection.on('connected', () =>
  console.log(`✔ Local MongoDB (backup) connected: ${LOCAL_URI}`)
);
localConnection.on('error', (err) =>
  console.error('❌ Local MongoDB (backup) error:', err.message)
);
localConnection.on('disconnected', () =>
  console.warn('⚠ Local MongoDB (backup) disconnected — writes will resume when reconnected')
);

export default localConnection;
