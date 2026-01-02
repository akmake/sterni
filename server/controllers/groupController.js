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
    // מקבלים את השדות החדשים
    const { name, contactPerson, startDate, endDate, pax, minPax, hostingType } = req.body;
    
    const group = await Group.create({
      name,
      contactPerson,
      startDate,
      endDate,
      pax,
      minPax: minPax || 0,         // <-- הוסף
      hostingType: hostingType || 'seminar', // <-- הוסף
      createdBy: req.user.id
    });
    res.status(201).json(group);
  } catch (err) { next(err); }
};

export const updateGroupDetails = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const updates = req.body; 

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
    // פירוק כל השדות החדשים
    const { title, date, startTime, endTime, hall, requirements, pax, eventType, mealType, kosherType, locationText } = req.body;

    // בדיקת חפיפות רק אם זה אירוע עם אולם פיזי
    if (hall) {
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
    }

    const group = await Group.findById(groupId);
    if (!group) return next(new AppError('Group not found', 404));

    // הוספת האירוע
    group.schedule.push({ 
        title, date, startTime, endTime, hall, requirements, pax,
        eventType, mealType, kosherType, locationText
    });
    await group.save();

    const updated = await Group.findById(groupId).populate('schedule.hall');
    res.json(updated);

  } catch (err) { next(err); }
};

export const updateGroupEvent = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const { title, date, startTime, endTime, hall, requirements, pax, eventType, mealType, kosherType, locationText } = req.body;

    // בדיקת חפיפות (רק אם יש אולם)
    if (hall) {
        const conflict = await Group.findOne({
          schedule: {
            $elemMatch: {
              _id: { $ne: eventId },
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
           return next(new AppError(`האולם תפוס בשעות אלו ע"י: ${conflict.name}`, 409));
        }
    }

    // הכנת אובייקט העדכון
    const setFields = {
        "schedule.$.title": title,
        "schedule.$.date": date,
        "schedule.$.startTime": startTime,
        "schedule.$.endTime": endTime,
        "schedule.$.requirements": requirements,
        "schedule.$.pax": pax,
        "schedule.$.eventType": eventType,
        "schedule.$.mealType": mealType,
        "schedule.$.kosherType": kosherType,
        "schedule.$.locationText": locationText,
        // אם אין אולם (באירוע כללי), שולחים null כדי לאפס את השדה ב-DB
        "schedule.$.hall": hall || null 
    };

    const group = await Group.findOneAndUpdate(
      { "_id": groupId, "schedule._id": eventId },
      { $set: setFields },
      { new: true, runValidators: true }
    ).populate('schedule.hall');

    if (!group) return next(new AppError('Group or Event not found', 404));

    res.json(group);
  } catch (err) { next(err); }
};

export const removeEventFromGroup = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const group = await Group.findById(groupId);
    group.schedule.pull({ _id: eventId });
    await group.save();
    const updated = await Group.findById(groupId).populate('schedule.hall');
    res.json(updated);
  } catch (err) { next(err); }
};