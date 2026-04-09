/**
 * migrateHotelData.js
 * מעתיק מלונות, מחירונים, סוגי חדרים ותוספות מה-Zipori DB ל-Main DB.
 * הרצה: cd server && node migrateHotelData.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// ─── Source schemas (Zipori DB) ────────────────────────────────────────────────
const ziporiConn = mongoose.createConnection(process.env.ZIPORI_MONGO_URI);

const ZHotel = ziporiConn.model('Hotel', new mongoose.Schema({
  name: String,
  checklists: Object,
}, { timestamps: true }));

const ZPriceList = ziporiConn.model('PriceList', new mongoose.Schema({
  name: String,
  hotel: mongoose.Schema.Types.ObjectId,
  couple: Number, teen: Number, child: Number, baby: Number,
  single_room: Number, fixedNights: Number, maxNights: Number,
  isVisible: Boolean, displayOrder: Number,
}, { timestamps: true }));

const ZRoomType = ziporiConn.model('RoomType', new mongoose.Schema({
  hotel: mongoose.Schema.Types.ObjectId,
  name: String,
  supplementPerNight: Number,
  isDefault: Boolean,
}, { timestamps: true }));

const ZExtraType = ziporiConn.model('ExtraType', new mongoose.Schema({
  name: String,
}, { timestamps: true }));

// ─── Destination schemas (Main DB) ────────────────────────────────────────────
const mainConn = mongoose.createConnection(process.env.MONGO_URI);

const MHotel = mainConn.model('Hotel', new mongoose.Schema({
  name: String,
  checklists: Object,
}, { timestamps: true }));

const MPriceList = mainConn.model('PriceList', new mongoose.Schema({
  name: String,
  hotel: mongoose.Schema.Types.ObjectId,
  couple: Number, teen: Number, child: Number, baby: Number,
  single_room: Number, fixedNights: Number, maxNights: Number,
  isVisible: Boolean, displayOrder: Number,
}, { timestamps: true }));

const MRoomType = mainConn.model('RoomType', new mongoose.Schema({
  hotel: mongoose.Schema.Types.ObjectId,
  name: String,
  supplementPerNight: Number,
  isDefault: Boolean,
}, { timestamps: true }));

const MExtraType = mainConn.model('ExtraType', new mongoose.Schema({
  name: String,
}, { timestamps: true }));

// ─── Migration ────────────────────────────────────────────────────────────────
const migrate = async () => {
  console.log('⏳ מחכה לחיבור לשני מסדי הנתונים...');
  await Promise.all([
    new Promise(r => ziporiConn.once('open', r)),
    new Promise(r => mainConn.once('open', r)),
  ]);
  console.log('✅ שני החיבורים פעילים\n');

  // ── 1. Hotels ──
  const sourceHotels = await ZHotel.find({}).lean();
  console.log(`📋 נמצאו ${sourceHotels.length} מלונות ב-Zipori`);

  const hotelIdMap = {}; // ziporiId → mainId

  for (const h of sourceHotels) {
    const exists = await MHotel.findOne({ name: h.name });
    if (exists) {
      hotelIdMap[h._id.toString()] = exists._id;
      console.log(`  ⏭  מלון קיים: "${h.name}" (דילוג)`);
      continue;
    }
    const created = await MHotel.create({ name: h.name, checklists: h.checklists || {} });
    hotelIdMap[h._id.toString()] = created._id;
    console.log(`  ➕ מלון נוצר: "${h.name}"`);
  }

  // ── 2. ExtraTypes ──
  const sourceExtras = await ZExtraType.find({}).lean();
  console.log(`\n📋 נמצאו ${sourceExtras.length} תוספות ב-Zipori`);

  for (const e of sourceExtras) {
    const exists = await MExtraType.findOne({ name: e.name });
    if (exists) { console.log(`  ⏭  תוספת קיימת: "${e.name}" (דילוג)`); continue; }
    await MExtraType.create({ name: e.name });
    console.log(`  ➕ תוספת נוצרה: "${e.name}"`);
  }

  // ── 3. PriceLists ──
  const sourcePriceLists = await ZPriceList.find({}).lean();
  console.log(`\n📋 נמצאו ${sourcePriceLists.length} מחירונים ב-Zipori`);

  for (const p of sourcePriceLists) {
    const mainHotelId = hotelIdMap[p.hotel?.toString()];
    if (!mainHotelId) {
      console.warn(`  ⚠️  מחירון "${p.name}" — מלון לא נמצא, מדלג`);
      continue;
    }
    const exists = await MPriceList.findOne({ name: p.name, hotel: mainHotelId });
    if (exists) { console.log(`  ⏭  מחירון קיים: "${p.name}" (דילוג)`); continue; }
    await MPriceList.create({
      name: p.name,
      hotel: mainHotelId,
      couple: p.couple ?? 0,
      teen: p.teen ?? 0,
      child: p.child ?? 0,
      baby: p.baby ?? 0,
      single_room: p.single_room ?? 0,
      fixedNights: p.fixedNights ?? 0,
      maxNights: p.maxNights ?? 0,
      isVisible: p.isVisible ?? true,
      displayOrder: p.displayOrder ?? 0,
    });
    console.log(`  ➕ מחירון נוצר: "${p.name}"`);
  }

  // ── 4. RoomTypes ──
  const sourceRoomTypes = await ZRoomType.find({}).lean();
  console.log(`\n📋 נמצאו ${sourceRoomTypes.length} סוגי חדרים ב-Zipori`);

  for (const r of sourceRoomTypes) {
    const mainHotelId = hotelIdMap[r.hotel?.toString()];
    if (!mainHotelId) {
      console.warn(`  ⚠️  סוג חדר "${r.name}" — מלון לא נמצא, מדלג`);
      continue;
    }
    const exists = await MRoomType.findOne({ name: r.name, hotel: mainHotelId });
    if (exists) { console.log(`  ⏭  סוג חדר קיים: "${r.name}" (דילוג)`); continue; }
    await MRoomType.create({
      hotel: mainHotelId,
      name: r.name,
      supplementPerNight: r.supplementPerNight ?? 0,
      isDefault: r.isDefault ?? false,
    });
    console.log(`  ➕ סוג חדר נוצר: "${r.name}"`);
  }

  console.log('\n🎉 Migration הושלם בהצלחה!');
  await ziporiConn.close();
  await mainConn.close();
  process.exit(0);
};

migrate().catch(err => {
  console.error('❌ שגיאה קריטית:', err);
  process.exit(1);
});
