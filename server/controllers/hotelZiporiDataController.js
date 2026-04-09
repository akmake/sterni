import Hotel from '../models/Hotel.js';
import PriceList from '../models/PriceList.js';
import RoomType from '../models/RoomType.js';
import ExtraType from '../models/ExtraType.js';

// ─── Hotels ───────────────────────────────────────────────────────────────────

export const getHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find({}).sort({ name: 1 });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת המלונות.', detail: err.message });
  }
};

export const createHotel = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'שם המלון הוא שדה חובה.' });
    const hotel = await Hotel.create({ name: name.trim() });
    res.status(201).json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה ביצירת המלון.', detail: err.message });
  }
};

export const updateMasterChecklist = async (req, res) => {
  try {
    const { checklists } = req.body;
    const hotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      { $set: { checklists } },
      { new: true }
    );
    if (!hotel) return res.status(404).json({ message: 'מלון לא נמצא.' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשמירת הנהלים.' });
  }
};

export const deleteHotel = async (req, res) => {
  try {
    const priceListsExist = await PriceList.exists({ hotel: req.params.id });
    if (priceListsExist) {
      return res.status(400).json({ message: 'לא ניתן למחוק מלון שמשויכים אליו מחירונים.' });
    }
    const hotel = await Hotel.findByIdAndDelete(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'מלון לא נמצא.' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת המלון.' });
  }
};

// ─── Price Lists ───────────────────────────────────────────────────────────────

export const getPriceLists = async (req, res) => {
  try {
    const { hotelId, active } = req.query;
    const filter = {};
    if (hotelId) filter.hotel = hotelId;
    if (active === 'true') filter.isVisible = true;
    const priceLists = await PriceList.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .populate('hotel', 'name');
    res.json(priceLists);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת המחירונים.' });
  }
};

export const createPriceList = async (req, res) => {
  try {
    const { name, hotel, couple, teen, child, baby, single_room, fixedNights, maxNights, displayOrder, isVisible } = req.body;
    if (!name || !hotel) return res.status(400).json({ message: 'שם המחירון ושיוך למלון הם שדות חובה.' });
    const pl = await PriceList.create({
      name, hotel,
      couple: Number(couple || 0),
      teen: Number(teen || 0),
      child: Number(child || 0),
      baby: Number(baby || 0),
      single_room: Number(single_room || 0),
      fixedNights: Number(fixedNights || 0),
      maxNights: Number(maxNights || 0),
      displayOrder: Number(displayOrder || 0),
      isVisible: isVisible !== undefined ? isVisible : true,
      user: req.user?._id,
    });
    res.status(201).json(pl);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'שם מחירון זה כבר קיים עבור המלון שנבחר.' });
    res.status(500).json({ message: 'שגיאה ביצירת המחירון.' });
  }
};

export const updatePriceList = async (req, res) => {
  try {
    const { name, ...rest } = req.body;
    if (!name) return res.status(400).json({ message: 'שם המחירון הוא שדה חובה.' });
    const pl = await PriceList.findByIdAndUpdate(req.params.id, { name, ...rest }, { new: true, runValidators: true });
    if (!pl) return res.status(404).json({ message: 'מחירון לא נמצא.' });
    res.json(pl);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'שם מחירון זה כבר קיים עבור המלון שנבחר.' });
    res.status(500).json({ message: 'שגיאה בעדכון המחירון.' });
  }
};

export const deletePriceList = async (req, res) => {
  try {
    const pl = await PriceList.findByIdAndDelete(req.params.id);
    if (!pl) return res.status(404).json({ message: 'מחירון לא נמצא.' });
    res.json({ message: 'המחירון נמחק בהצלחה.' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת המחירון.' });
  }
};

// ─── Room Types ────────────────────────────────────────────────────────────────

export const getRoomTypesByHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const roomTypes = await RoomType.find({ hotel: hotelId }).sort({ supplementPerNight: 1 });
    res.json(roomTypes);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת סוגי החדרים.' });
  }
};

export const createRoomType = async (req, res) => {
  try {
    const { hotel, name, supplementPerNight, isDefault } = req.body;
    if (!hotel || !name) return res.status(400).json({ message: 'מלון ושם חדר הם שדות חובה.' });
    if (isDefault) await RoomType.updateMany({ hotel }, { isDefault: false });
    const rt = await RoomType.create({ hotel, name, supplementPerNight: Number(supplementPerNight) || 0, isDefault: !!isDefault });
    res.status(201).json(rt);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'סוג חדר בשם זה כבר קיים במלון שנבחר.' });
    res.status(500).json({ message: 'שגיאה ביצירת סוג החדר.' });
  }
};

export const updateRoomType = async (req, res) => {
  try {
    const { name, supplementPerNight, isDefault, hotel } = req.body;
    if (isDefault && hotel) await RoomType.updateMany({ hotel }, { isDefault: false });
    const rt = await RoomType.findByIdAndUpdate(req.params.id, { name, supplementPerNight, isDefault }, { new: true, runValidators: true });
    if (!rt) return res.status(404).json({ message: 'סוג חדר לא נמצא.' });
    res.json(rt);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'סוג חדר בשם זה כבר קיים במלון שנבחר.' });
    res.status(500).json({ message: 'שגיאה בעדכון סוג החדר.' });
  }
};

export const deleteRoomType = async (req, res) => {
  try {
    const rt = await RoomType.findByIdAndDelete(req.params.id);
    if (!rt) return res.status(404).json({ message: 'סוג חדר לא נמצא.' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת סוג החדר.' });
  }
};

// ─── Extra Types ───────────────────────────────────────────────────────────────

export const getExtraTypes = async (req, res) => {
  try {
    const extras = await ExtraType.find({}).sort({ name: 1 });
    res.json(extras);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת סוגי התוספות.' });
  }
};

export const createExtraType = async (req, res) => {
  try {
    const { name } = req.body;
    const extra = await ExtraType.create({ name });
    res.status(201).json(extra);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה ביצירת סוג התוספת.' });
  }
};

export const deleteExtraType = async (req, res) => {
  try {
    await ExtraType.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'שגיאה במחיקת סוג התוספת.' });
  }
};
