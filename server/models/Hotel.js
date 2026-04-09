import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  checklists: {
    departure: [checklistItemSchema],
    stayover:  [checklistItemSchema],
    arrival:   [checklistItemSchema],
  }
}, { timestamps: true });

export default mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema);
