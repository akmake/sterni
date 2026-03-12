import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  adults: { type: Number, required: true, min: 0 },
  teens: { type: Number, required: true, min: 0 },
  children: { type: Number, required: true, min: 0 },
  babies: { type: Number, required: true, min: 0 },
  price_list_names: [String],
  price: { type: Number, required: true },
  roomType: { type: String, required: true, default: 'רגיל' },
  roomSupplement: { type: Number, default: 0 },
  notes: { type: String, trim: true }
}, { _id: false });

const extraSchema = new mongoose.Schema({
  extraType: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const hotelOrderSchema = new mongoose.Schema({
  orderNumber: { type: Number, unique: true, required: true },
  hotelId: { type: String, required: true }, // ObjectId as string (from zipori DB)
  hotelName: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salespersonName: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedByName: { type: String, default: null },
  optimaNumber: { type: String, trim: true, default: null },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  eventDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['בהמתנה', 'בוצע', 'לא רלוונטי'],
    default: 'בהמתנה',
  },
  numberOfNights: { type: Number, required: true, default: 1 },
  rooms: [roomSchema],
  extras: [extraSchema],
  discountPercent: { type: Number, default: 0 },
  total_price: { type: Number, required: true },
  notes: { type: String, trim: true },
  interactions: [{
    type: { type: String },
    date: { type: Date, default: Date.now },
    description: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Object }
  }]
}, { timestamps: true });

export default mongoose.models.HotelOrder || mongoose.model('HotelOrder', hotelOrderSchema);
