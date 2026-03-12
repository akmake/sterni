import ziporiConnection from '../../db/ziporiDb.js';
import mongoose from 'mongoose';

const extraTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });

export default ziporiConnection.model('ExtraType', extraTypeSchema);
