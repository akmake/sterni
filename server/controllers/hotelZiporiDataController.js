import ZiporiHotel from '../models/zipori/Hotel.js';
import ZiporiPriceList from '../models/zipori/PriceList.js';
import ZiporiRoomType from '../models/zipori/RoomType.js';
import ZiporiExtraType from '../models/zipori/ExtraType.js';

// קבלת כל המלונות מ-zipori
export const getHotels = async (req, res) => {
  try {
    const hotels = await ZiporiHotel.find({}).select('name').sort({ name: 1 });
    res.json(hotels);
  } catch (err) {
    console.error('❌ getHotels error:', err.message);
    res.status(500).json({ message: 'שגיאה בטעינת המלונות.', detail: err.message });
  }
};

// קבלת מחירונים מ-zipori (לפי מלון)
export const getPriceLists = async (req, res) => {
  try {
    const { hotelId, active } = req.query;
    const filter = {};
    if (hotelId) filter.hotel = hotelId;
    if (active === 'true') filter.isVisible = true;

    const priceLists = await ZiporiPriceList.find(filter)
      .sort({ displayOrder: 1, name: 1 });
    res.json(priceLists);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת המחירונים.' });
  }
};

// קבלת סוגי חדרים מ-zipori (לפי מלון)
export const getRoomTypesByHotel = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const roomTypes = await ZiporiRoomType.find({ hotel: hotelId }).sort({ name: 1 });
    res.json(roomTypes);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בטעינת סוגי החדרים.' });
  }
};

// קבלת סוגי תוספות מ-zipori
export const getExtraTypes = async (req, res) => {
  try {
    const extras = await ZiporiExtraType.find({}).sort({ name: 1 });
    res.json(extras);
  } catch (err) {
    console.error('❌ getExtraTypes error:', err.message);
    res.status(500).json({ message: 'שגיאה בטעינת סוגי התוספות.', detail: err.message });
  }
};
