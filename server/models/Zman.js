import mongoose from 'mongoose';

const zmanSchema = new mongoose.Schema({
  locationId: { type: Number, required: true },
  cityName:   { type: String, required: true },
  date:       { type: String, required: true }, // YYYY-MM-DD
  zmanim: [
    {
      type: { type: String },  // e.g. 'NetzHachamah'
      time: { type: String },  // e.g. '6:35'
    },
  ],
});

zmanSchema.index({ locationId: 1, date: 1 }, { unique: true });

export default mongoose.model('Zman', zmanSchema);
