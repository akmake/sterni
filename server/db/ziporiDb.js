import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';

// חיבור נפרד ל-MongoDB של ziporiclass (לקריאת מחירונים, מלונות וסוגי חדרים)
const ziporiConnection = mongoose.createConnection(
  process.env.ZIPORI_MONGO_URI,
  { serverSelectionTimeoutMS: 5000 }
);

ziporiConnection.on('connected', () => console.log('✔ Zipori MongoDB connected (read-only)'));
ziporiConnection.on('error', (err) => console.error('❌ Zipori MongoDB connection error:', err.message));

export default ziporiConnection;
