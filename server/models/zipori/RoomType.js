import ziporiConnection from '../../db/ziporiDb.js';
import mongoose from 'mongoose';

const roomTypeSchema = new mongoose.Schema({
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', index: true },
  name: { type: String, required: true, trim: true },
  supplementPerNight: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export default ziporiConnection.model('RoomType', roomTypeSchema);
