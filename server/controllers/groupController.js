import Group from '../models/Group.js';
import AppError from '../utils/AppError.js';

export const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({})
      .populate('schedule.hall')
      .sort({ startDate: 1 });
    res.json(groups);
  } catch (err) { next(err); }
};

export const createGroup = async (req, res, next) => {
  try {
    // מקבלים גם את ה-pax
    const { name, contactPerson, startDate, endDate, pax } = req.body;
    const group = await Group.create({
      name,
      contactPerson,
      startDate,
      endDate,
      pax, // <-- שמירה
      createdBy: req.user.id
    });
    res.status(201).json(group);
  } catch (err) { next(err); }
};

// פונקציה חדשה: עדכון פרטים כלליים (שם, אנשים, איש קשר)
export const updateGroupDetails = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const updates = req.body; // יכיל pax, name, contactPerson וכו'
        
        const group = await Group.findByIdAndUpdate(
            groupId, 
            { $set: updates }, 
            { new: true, runValidators: true }
        ).populate('schedule.hall');

        if (!group) return next(new AppError('Group not found', 404));
        res.json(group);
    } catch (err) { next(err); }
};

export const addEventToGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    // מקבלים גם את ה-pax של האירוע
    const { title, date, startTime, endTime, hall, requirements, pax } = req.body;

    const conflict = await Group.findOne({
      _id: { $ne: groupId },
      schedule: {
        $elemMatch: {
          hall: hall,
          date: new Date(date),
          $or: [{
             $and: [
               { startTime: { $lt: endTime } },
               { endTime: { $gt: startTime } }
             ]
          }]
        }
      }
    });

    if (conflict) {
      return next(new AppError(`האולם תפוס ע"י קבוצה אחרת: ${conflict.name}`, 409));
    }

    const group = await Group.findById(groupId);
    if (!group) return next(new AppError('Group not found', 404));

    // הוספת האירוע עם ה-pax
    group.schedule.push({ title, date, startTime, endTime, hall, requirements, pax });
    await group.save();

    const updated = await Group.findById(groupId).populate('schedule.hall');
    res.json(updated);

  } catch (err) { next(err); }
};

export const updateGroupEvent = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const { title, date, startTime, endTime, hall, requirements, pax } = req.body;

    // 1. בדיקת חפיפות (Conflict Check)
    // אנחנו בודקים האם יש אירוע *אחר* (בקבוצה אחרת או בזו) שחוסם אותנו
    const conflict = await Group.findOne({
      schedule: {
        $elemMatch: {
          _id: { $ne: eventId }, // מתעלמים מהאירוע הנוכחי שאנחנו עורכים
          hall: hall,
          date: new Date(date),
          $or: [{
             $and: [
               { startTime: { $lt: endTime } }, 
               { endTime: { $gt: startTime } }
             ]
          }]
        }
      }
    });

    if (conflict) {
       // אם מצאנו קונפליקט, נבדוק אם זה לא הקבוצה עצמה (למרות ה-$ne לפעמים צריך לוודא)
       return next(new AppError(`האולם תפוס בשעות אלו ע"י: ${conflict.name}`, 409));
    }

    // 2. ביצוע העדכון
    const group = await Group.findOneAndUpdate(
      { "_id": groupId, "schedule._id": eventId },
      { 
        $set: {
          "schedule.$.title": title,
          "schedule.$.date": date,
          "schedule.$.startTime": startTime,
          "schedule.$.endTime": endTime,
          "schedule.$.hall": hall,
          "schedule.$.requirements": requirements,
          "schedule.$.pax": pax
        }
      },
      { new: true, runValidators: true }
    ).populate('schedule.hall');

    if (!group) return next(new AppError('Group or Event not found', 404));

    res.json(group);
  } catch (err) { next(err); }
};

// ... (removeEventFromGroup נשאר אותו דבר)
export const removeEventFromGroup = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const group = await Group.findById(groupId);
    group.schedule.pull({ _id: eventId });
    await group.save();
    // מחזירים את הקבוצה המעודכנת
    const updated = await Group.findById(groupId).populate('schedule.hall'); 
    res.json(updated);
  } catch (err) { next(err); }
};