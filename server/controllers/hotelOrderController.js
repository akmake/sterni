import HotelOrder from '../models/HotelOrder.js';
import ZiporiPriceList from '../models/zipori/PriceList.js';
import ZiporiRoomType from '../models/zipori/RoomType.js';
import ZiporiHotel from '../models/zipori/Hotel.js';
import { calculateRoomTotalPrice } from '../lib/hotelPriceCalculator.js';
import { getNextHotelOrderNumber } from '../models/HotelCounter.js';

const calculateFinalTotal = (roomsPrice, extras, discountPercent) => {
  const extrasTotal = (extras || []).reduce((sum, ex) => sum + (ex.price * ex.quantity), 0);
  const subTotal = roomsPrice + extrasTotal;
  const discountAmount = subTotal * (discountPercent / 100);
  return Math.max(0, subTotal - discountAmount);
};

// יצירת הזמנה
export const createHotelOrder = async (req, res) => {
  const {
    hotelId, hotelName, rooms, notes, customerName, customerPhone,
    status, numberOfNights = 1, extras = [], discountPercent = 0,
    customerEmail, eventDate
  } = req.body;

  if (!hotelId) return res.status(400).json({ message: 'חובה לבחור מלון.' });
  if (!customerName) return res.status(400).json({ message: 'שם הלקוח הוא שדה חובה.' });
  if ((!rooms || rooms.length === 0) && (!extras || extras.length === 0)) {
    return res.status(400).json({ message: 'ההזמנה חייבת להכיל לפחות חדר אחד או תוספת אחת.' });
  }

  try {
    const priceListsFromDB = await ZiporiPriceList.find({ hotel: hotelId });
    const priceListsMap = Object.fromEntries(priceListsFromDB.map(pl => [pl.name, pl.toObject()]));
    const hotelRoomTypes = await ZiporiRoomType.find({ hotel: hotelId });
    const roomTypesMap = Object.fromEntries(hotelRoomTypes.map(rt => [rt._id.toString(), rt]));

    let roomsTotalPrice = 0;
    const roomsWithPrice = (rooms || []).map(room => {
      let supplement = 0;
      let roomTypeName = 'רגיל';
      if (room.roomTypeId && roomTypesMap[room.roomTypeId]) {
        const rt = roomTypesMap[room.roomTypeId];
        supplement = rt.supplementPerNight || 0;
        roomTypeName = rt.name;
      } else if (room.roomSupplement !== undefined) {
        supplement = room.roomSupplement;
      }
      const price = calculateRoomTotalPrice(room, priceListsMap, room.price_list_names, numberOfNights, supplement);
      roomsTotalPrice += price;
      return { ...room, price, roomType: roomTypeName, roomSupplement: supplement };
    });

    const finalPrice = calculateFinalTotal(roomsTotalPrice, extras, discountPercent);
    const orderNumber = await getNextHotelOrderNumber();

    const newOrder = await HotelOrder.create({
      orderNumber, hotelId, hotelName: hotelName || 'מלון',
      user: req.user.id, salespersonName: req.user.name,
      createdBy: req.user.id, createdByName: req.user.name,
      customerName, customerPhone, customerEmail,
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      status: status || 'בהמתנה', numberOfNights,
      rooms: roomsWithPrice, extras, discountPercent,
      total_price: finalPrice, notes,
    });

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Hotel order creation error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת ההזמנה.' });
  }
};

// עדכון הזמנה
export const updateHotelOrder = async (req, res) => {
  try {
    const order = await HotelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });

    const oldStatus = order.status;
    const customerName = req.body.customerName || order.customerName;
    const customerPhone = req.body.customerPhone || order.customerPhone;
    const customerEmail = req.body.customerEmail !== undefined ? req.body.customerEmail : order.customerEmail;
    const status = req.body.status || order.status;
    const notes = req.body.notes !== undefined ? req.body.notes : order.notes;
    const numberOfNights = req.body.numberOfNights || order.numberOfNights;
    const discountPercent = req.body.discountPercent !== undefined ? req.body.discountPercent : order.discountPercent;
    const optimaNumber = req.body.optimaNumber !== undefined ? req.body.optimaNumber : order.optimaNumber;
    const eventDate = req.body.eventDate ? new Date(req.body.eventDate) : order.eventDate;

    if (status === 'בוצע' && oldStatus !== 'בוצע') {
      if (!optimaNumber) return res.status(400).json({ message: 'חובה להזין מספר הזמנה מאופטימה כדי לסגור עסקה.' });
      order.closedBy = req.user.id;
      order.closedByName = req.user.name;
    }

    let roomsWithPrice = order.rooms;
    let roomsTotalPrice = 0;

    if (req.body.rooms || req.body.numberOfNights) {
      const priceListsFromDB = await ZiporiPriceList.find({ hotel: order.hotelId });
      const priceListsMap = Object.fromEntries(priceListsFromDB.map(pl => [pl.name, pl.toObject()]));
      const hotelRoomTypes = await ZiporiRoomType.find({ hotel: order.hotelId });
      const roomTypesMap = Object.fromEntries(hotelRoomTypes.map(rt => [rt._id.toString(), rt]));

      const roomsToProcess = req.body.rooms || order.rooms;
      roomsWithPrice = roomsToProcess.map(room => {
        let supplement = room.roomSupplement || 0;
        let roomTypeName = room.roomType || 'רגיל';
        if (room.roomTypeId && roomTypesMap[room.roomTypeId]) {
          const rt = roomTypesMap[room.roomTypeId];
          supplement = rt.supplementPerNight || 0;
          roomTypeName = rt.name;
        }
        const price = calculateRoomTotalPrice(room, priceListsMap, room.price_list_names, numberOfNights, supplement);
        roomsTotalPrice += price;
        return { ...room, price, roomType: roomTypeName, roomSupplement: supplement };
      });
    } else {
      roomsTotalPrice = order.rooms.reduce((sum, r) => sum + r.price, 0);
    }

    const extras = req.body.extras !== undefined ? req.body.extras : order.extras;
    let finalPrice = calculateFinalTotal(roomsTotalPrice, extras, discountPercent);
    if (req.body.total_price !== undefined) finalPrice = req.body.total_price;

    const statusChanged = status !== oldStatus;
    if (statusChanged) {
      if (!order.interactions) order.interactions = [];
      order.interactions.push({
        type: 'status_change',
        date: new Date(),
        description: `סטטוס שונה מ-"${oldStatus}" ל-"${status}"`,
        user: req.user.id,
        metadata: { previousStatus: oldStatus, newStatus: status }
      });
    }

    order.customerName = customerName;
    order.customerPhone = customerPhone;
    order.customerEmail = customerEmail;
    order.status = status;
    order.notes = notes;
    order.numberOfNights = numberOfNights;
    order.rooms = roomsWithPrice;
    order.extras = extras;
    order.discountPercent = discountPercent;
    order.total_price = finalPrice;
    order.optimaNumber = optimaNumber;
    order.eventDate = eventDate;

    const updated = await order.save();
    res.json(updated);
  } catch (error) {
    console.error('Hotel order update error:', error);
    res.status(500).json({ message: 'שגיאה בעדכון ההזמנה' });
  }
};

// שליפת ההזמנות שלי
export const getMyHotelOrders = async (req, res) => {
  try {
    const orders = await HotelOrder.find({ user: req.user.id }).sort({ orderNumber: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בטעינת ההזמנות.' });
  }
};

// שליפת כל ההזמנות
export const getAllHotelOrders = async (req, res) => {
  try {
    const orders = await HotelOrder.find({}).populate('user', 'name').sort({ orderNumber: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בטעינת ההזמנות.' });
  }
};

// שליפת הזמנה לפי ID
export const getHotelOrderById = async (req, res) => {
  try {
    const order = await HotelOrder.findById(req.params.id).populate('user', 'name');
    if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בטעינת ההזמנה' });
  }
};

// חיפוש הזמנות
export const searchHotelOrders = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);
    const orders = await HotelOrder.find({
      $and: [
        { status: { $ne: 'לא רלוונטי' } },
        {
          $or: [
            { customerName: { $regex: query, $options: 'i' } },
            { customerPhone: { $regex: query, $options: 'i' } },
            ...(!isNaN(query) ? [{ orderNumber: Number(query) }] : [])
          ]
        }
      ]
    })
    .select('orderNumber customerName customerPhone status hotelId hotelName total_price createdByName createdAt optimaNumber rooms extras notes discountPercent')
    .sort({ createdAt: -1 })
    .limit(10);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בחיפוש הזמנות.' });
  }
};

// מחיקת הזמנה
export const deleteHotelOrder = async (req, res) => {
  try {
    const order = await HotelOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'אין הרשאה למחוק הזמנה זו' });
    }
    await HotelOrder.findByIdAndDelete(req.params.id);
    res.json({ message: 'ההזמנה נמחקה' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה במחיקת ההזמנה' });
  }
};

// הזמנה ציבורית (ללא אימות) - לדפי הצעת מחיר ואישור
export const getPublicHotelOrderById = async (req, res) => {
  try {
    const order = await HotelOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: 'ההזמנה לא נמצאה' });

    let hotel = { name: order.hotelName };
    try {
      const hotelDoc = await ZiporiHotel.findById(order.hotelId).lean();
      if (hotelDoc) hotel = { ...hotelDoc, name: hotelDoc.name };
    } catch (_) {}

    res.json({ ...order, hotel });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בטעינת ההזמנה' });
  }
};

// סטטיסטיקות
export const getMyHotelOrderStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [openOrders, monthlySales] = await Promise.all([
      HotelOrder.aggregate([
        { $match: { user: userId, status: 'בהמתנה' } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$total_price' } } }
      ]),
      HotelOrder.aggregate([
        { $match: { user: userId, status: 'בוצע', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$total_price' } } }
      ])
    ]);

    res.json({
      pending: { count: openOrders[0]?.count || 0, value: openOrders[0]?.totalValue || 0 },
      monthly: { count: monthlySales[0]?.count || 0, value: monthlySales[0]?.totalValue || 0 },
    });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בטעינת הסטטיסטיקות' });
  }
};
