import ziporiConnection from '../../db/ziporiDb.js';
import mongoose from 'mongoose';

const priceListSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  couple: { type: Number, default: 0 },
  teen: { type: Number, default: 0 },
  child: { type: Number, default: 0 },
  baby: { type: Number, default: 0 },
  single_room: { type: Number, default: 0 },
  fixedNights: { type: Number, default: 0 },
  maxNights: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  user: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

export default ziporiConnection.model('PriceList', priceListSchema);
