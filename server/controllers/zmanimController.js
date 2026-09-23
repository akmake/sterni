import Zman from '../models/Zman.js';
import {
  ComplexZmanimCalendar,
  GeoLocation,
  DateTime,
} from 'kosher-zmanim';
import tzlookup from 'tz-lookup';

const CITY_COORDINATES = {
  531: { name: 'תל אביב', lat: 32.0853, lng: 34.7818, tz: 'Asia/Jerusalem' },
  247: { name: 'ירושלים', lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem' },
  689: { name: 'חיפה',    lat: 32.7940, lng: 34.9896, tz: 'Asia/Jerusalem' },
  688: { name: 'באר שבע', lat: 31.2530, lng: 34.7915, tz: 'Asia/Jerusalem' },
};

function formatHHMM(luxonDt, tz) {
  if (!luxonDt) return null;
  try {
    return luxonDt.setZone(tz).toFormat('HH:mm');
  } catch {
    return null;
  }
}

/**
 * Calculates 12 Chabad (Baal HaTanya) halachic times for a given date and coordinates.
 */
function calculateDayZmanim(dateStr, lat, lng, tz) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const geo = new GeoLocation('', lat, lng, 0, tz);
  const cal = new ComplexZmanimCalendar(geo);

  // Set date noon local time
  cal.setDate(DateTime.fromObject({ year, month, day, hour: 12 }, { zone: tz }));

  // 1. Alos Baal HaTanya (with polar summer midnight fallback)
  let alos = null;
  try {
    alos = cal.getAlosBaalHatanya();
  } catch {}
  if (!alos) {
    try { alos = cal.getSolarMidnight(); } catch {}
  }

  // 2. Misheyakir (10.2 degrees)
  let misheyakir = null;
  try { misheyakir = cal.getMisheyakir10Point2Degrees(); } catch {}

  // 3. Sunrise
  let sunrise = null;
  try { sunrise = cal.getSunrise(); } catch {}

  // 4. Sof Zman Shma Baal HaTanya
  let shma = null;
  try { shma = cal.getSofZmanShmaBaalHatanya(); } catch {}

  // 5. Sof Zman Tefillah Baal HaTanya
  let tfila = null;
  try { tfila = cal.getSofZmanTfilaBaalHatanya(); } catch {}

  // 6. Chatzos
  let chatzos = null;
  try { chatzos = cal.getChatzos(); } catch {}

  // 7. Mincha Gedolah Baal HaTanya
  let minchaGedola = null;
  try { minchaGedola = cal.getMinchaGedolaBaalHatanya(); } catch {}

  // 8. Mincha Ketanah Baal HaTanya
  let minchaKetana = null;
  try { minchaKetana = cal.getMinchaKetanaBaalHatanya(); } catch {}

  // 9. Plag Hamincha Baal HaTanya
  let plag = null;
  try { plag = cal.getPlagHaminchaBaalHatanya(); } catch {}

  // 10. Sunset
  let sunset = null;
  try { sunset = cal.getSunset(); } catch {}

  // 11. Tzais Baal HaTanya
  let tzais = null;
  try { tzais = cal.getTzaisBaalHatanya(); } catch {}
  if (!tzais) {
    try { tzais = cal.getSolarMidnight(); } catch {}
  }

  // 12. Solar Midnight
  let midnight = null;
  try { midnight = cal.getSolarMidnight(); } catch {}

  const zmanim = [
    { type: 'AlosHashachar',    label: 'עלות השחר',     time: formatHHMM(alos, tz) },
    { type: 'EarliestTefillin', label: 'משיכיר',          time: formatHHMM(misheyakir, tz) },
    { type: 'NetzHachamah',     label: 'הנץ החמה',        time: formatHHMM(sunrise, tz) },
    { type: 'LatestShema',      label: 'סוף זמן ק"ש',    time: formatHHMM(shma, tz) },
    { type: 'LatestTefillah',   label: 'סוף זמן תפילה',   time: formatHHMM(tfila, tz) },
    { type: 'Chatzos',          label: 'חצות היום',       time: formatHHMM(chatzos, tz) },
    { type: 'MinchahGedolah',   label: 'מנחה גדולה',     time: formatHHMM(minchaGedola, tz) },
    { type: 'MinchahKetanah',   label: 'מנחה קטנה',      time: formatHHMM(minchaKetana, tz) },
    { type: 'PlagHaminchah',    label: 'פלג המנחה',      time: formatHHMM(plag, tz) },
    { type: 'Shkiah',           label: 'שקיעת החמה',     time: formatHHMM(sunset, tz) },
    { type: 'Tzeis',            label: 'צאת הכוכבים',    time: formatHHMM(tzais, tz) },
    { type: 'ChatzosNight',     label: 'חצות הלילה',     time: formatHHMM(midnight, tz) },
  ].filter(z => z.time != null);

  return { date: dateStr, zmanim };
}

// GET /api/zmanim?lat=32.085&lng=34.781&date=2026-09-23
// OR GET /api/zmanim?locationId=531&from=2026-03-27&to=2026-04-26
export async function getZmanim(req, res) {
  try {
    const { lat, lng, locationId, from, to, date } = req.query;

    // 1. Dynamic calculation by coordinates
    if (lat && lng) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ message: 'lat ו-lng לא תקינים' });
      }

      let tz = 'Asia/Jerusalem';
      try {
        tz = tzlookup(latitude, longitude) || 'Asia/Jerusalem';
      } catch {}

      const startDate = from || date || new Date().toISOString().slice(0, 10);
      const endDate = to || startDate;

      const results = [];
      const cur = new Date(startDate);
      const end = new Date(endDate);

      // Limit to 31 days max per query
      let count = 0;
      while (cur <= end && count < 31) {
        const dStr = cur.toISOString().slice(0, 10);
        results.push(calculateDayZmanim(dStr, latitude, longitude, tz));
        cur.setDate(cur.getDate() + 1);
        count++;
      }

      return res.json(results);
    }

    // 2. Location ID based lookup or fallback calculation
    if (!locationId) {
      return res.status(400).json({ message: 'נדרש lat/lng או locationId ו-from' });
    }

    const locIdNum = Number(locationId);
    const startDate = from || date || new Date().toISOString().slice(0, 10);
    const query = { locationId: locIdNum, date: { $gte: startDate } };
    if (to) query.date.$lte = to;

    const docs = await Zman.find(query, 'date zmanim -_id').sort({ date: 1 }).lean();
    if (docs.length) {
      return res.json(docs);
    }

    // If not found in DB, check if it's one of known city coordinates and calculate!
    const city = CITY_COORDINATES[locIdNum];
    if (city) {
      const results = [];
      const cur = new Date(startDate);
      const end = new Date(to || startDate);
      let count = 0;
      while (cur <= end && count < 31) {
        const dStr = cur.toISOString().slice(0, 10);
        results.push(calculateDayZmanim(dStr, city.lat, city.lng, city.tz));
        cur.setDate(cur.getDate() + 1);
        count++;
      }
      return res.json(results);
    }

    return res.status(404).json({ message: 'לא נמצאו זמנים' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
