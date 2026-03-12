import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

const HotelCounter = mongoose.models.HotelCounter || mongoose.model('HotelCounter', counterSchema);

export async function getNextHotelOrderNumber() {
  const doc = await HotelCounter.findByIdAndUpdate(
    'hotelOrderNumber',
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return doc.sequence_value;
}
