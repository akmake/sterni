import Hotel from '../models/Hotel.js';
import PriceList from '../models/PriceList.js';
import RoomType from '../models/RoomType.js';
import ExtraType from '../models/ExtraType.js';

// ─── Hotels ───────────────────────────────────────────────────────────────────

export const getHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find({}).select('name').sort({ name: 1 });
    res.json(hotels);
  } catch (err) {
    console.error('❌ getHotels error:', err.message);
    res.status(500).json({ message: 'שגיאה בטעינת המלונות.', detail: err.message });
  }
};

export const createHotel = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'שם מלון הוא שדה חובה' });
    const hotel = await Hotel.create({ name: name.trim() });
    res.status(201).json(hotel);
  } catch (err) {
    console.error('❌ createHotel error:', err.message);
    res.status(500).json({ message: 'שגיאה ביצירת המלון.', detail: err.message });
  }
};

export const updateHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!hotel) return res.status(404).json({ message: 'מלון לא נמצא' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בעדכון המלון.', detail: err.message });
  }
};

export const deleteHotel = async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת המלון.', detail: err.message });
  }
};

// ─── Price Lists ───────────────────────────────────────────────────────────────

export const getPriceLists = async (req, res) => {
  try {
    const { hotelId, active } = req.query;
    const filter = {};
    if (hotelId) filter.hotel = hotelId;
    if (active === 'true') filter.isVisible = true;

    const priceLists = await PriceList.find(filter).sort({ displayOrder: 1, name: 1 });
    res.json(priceLists);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת המחירונים.' });
  }
};

export const createPriceList = async (req, res) => {
  try {
    const priceList = await PriceList.create(req.body);
    res.status(201).json(priceList);
  } catch (err) {
    console.error('❌ createPriceList error:', err.message);
    res.status(500).json({ message: 'שגיאה ביצירת המחירון.', detail: err.message });
  }
};

export const updatePriceList = async (req, res) => {
  try {
    const priceList = await PriceList.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!priceList) return res.status(404).json({ message: 'מחירון לא נמצא' });
    res.json(priceList);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בעדכון המחירון.', detail: err.message });
  }
};

export const deletePriceList = async (req, res) => {
  try {
    await PriceList.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת המחירון.', detail: err.message });
  }
};

// ─── Room Types ────────────────────────────────────────────────────────────────

export const getRoomTypesByHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const roomTypes = await RoomType.find({ hotel: hotelId }).sort({ name: 1 });
    res.json(roomTypes);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת סוגי החדרים.' });
  }
};

export const createRoomType = async (req, res) => {
  try {
    const roomType = await RoomType.create(req.body);
    res.status(201).json(roomType);
  } catch (err) {
    console.error('❌ createRoomType error:', err.message);
    res.status(500).json({ message: 'שגיאה ביצירת סוג החדר.', detail: err.message });
  }
};

export const updateRoomType = async (req, res) => {
  try {
    const roomType = await RoomType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!roomType) return res.status(404).json({ message: 'סוג חדר לא נמצא' });
    res.json(roomType);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בעדכון סוג החדר.', detail: err.message });
  }
};

export const deleteRoomType = async (req, res) => {
  try {
    await RoomType.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת סוג החדר.', detail: err.message });
  }
};

// ─── Extra Types ───────────────────────────────────────────────────────────────

export const getExtraTypes = async (req, res) => {
  try {
    const extras = await ExtraType.find({}).sort({ name: 1 });
    res.json(extras);
  } catch (err) {
    console.error('❌ getExtraTypes error:', err.message);
    res.status(500).json({ message: 'שגיאה בטעינת סוגי התוספות.', detail: err.message });
  }
};

export const createExtraType = async (req, res) => {
  try {
    const extra = await ExtraType.create(req.body);
    res.status(201).json(extra);
  } catch (err) {
    console.error('❌ createExtraType error:', err.message);
    res.status(500).json({ message: 'שגיאה ביצירת סוג התוספת.', detail: err.message });
  }
};

export const updateExtraType = async (req, res) => {
  try {
    const extra = await ExtraType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!extra) return res.status(404).json({ message: 'סוג תוספת לא נמצא' });
    res.json(extra);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בעדכון סוג התוספת.', detail: err.message });
  }
};

export const deleteExtraType = async (req, res) => {
  try {
    await ExtraType.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת סוג התוספת.', detail: err.message });
  }
};
