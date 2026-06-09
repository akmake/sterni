import mongoose from 'mongoose';

/**
 * Auditable record of a visitor accepting the data-collection disclosure.
 * Written by POST /api/logs/consent when the consent banner is acknowledged.
 */
const consentRecordSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, default: null, index: true },
    persistentId: { type: String, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ip: String,
    userAgent: String,
    version: { type: String, default: '1' },
    items: [String], // the list of data categories disclosed at consent time
  },
  { timestamps: true, collection: 'consent_records' }
);

consentRecordSchema.index({ createdAt: -1 });

export default mongoose.model('ConsentRecord', consentRecordSchema);
