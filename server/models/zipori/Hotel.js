import ziporiConnection from '../../db/ziporiDb.js';
import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  checklists: { type: Object, default: {} }
}, { timestamps: true });

export default ziporiConnection.model('Hotel', hotelSchema);
