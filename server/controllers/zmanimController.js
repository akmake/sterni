import Zman from '../models/Zman.js';

// GET /api/zmanim?locationId=531&from=2026-03-27&to=2026-04-26
export async function getZmanim(req, res) {
  const { locationId, from, to } = req.query;

  if (!locationId || !from) {
    return res.status(400).json({ message: 'נדרש locationId ו-from' });
  }

  const query = { locationId: Number(locationId), date: { $gte: from } };
  if (to) query.date.$lte = to;

  const docs = await Zman.find(query, 'date zmanim -_id').sort({ date: 1 }).lean();

  if (!docs.length) {
    return res.status(404).json({ message: 'לא נמצאו זמנים' });
  }

  res.json(docs);
}
