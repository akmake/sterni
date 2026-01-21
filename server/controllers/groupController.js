import Group from '../models/Group.js';
import AppError from '../utils/AppError.js';

// --- קבלת כל הקבוצות ---
export const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({})
      .populate('schedule.hall')
      .sort({ startDate: 1 });
    res.json(groups);
  } catch (err) { next(err); }
};

// --- קבלת קבוצה בודדת ---
export const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id || req.params.groupId).populate('schedule.hall');
    if (!group) return next(new AppError('Group not found', 404));
    res.json(group);
  } catch (err) { next(err); }
};

// --- יצירת קבוצה ---
export const createGroup = async (req, res, next) => {
  try {
    const { name, contactPerson, startDate, endDate, pax, minPax, hostingType } = req.body;
    
    const group = await Group.create({
      name,
      contactPerson,
      startDate,
      endDate,
      pax,
      minPax: minPax || 0,
      hostingType: hostingType || 'seminar',
      createdBy: req.user.id
    });
    res.status(201).json(group);
  } catch (err) { next(err); }
};

export const duplicateEvents = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { eventIds, targetDate } = req.body; // eventIds = מערך של מזהים, targetDate = התאריך שאליו מעתיקים

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'קבוצה לא נמצאה' });

    // המרה לתאריך יעד (מאפסים שעות כדי למנוע בעיות)
    const newDateObj = new Date(targetDate);
    newDateObj.setHours(0, 0, 0, 0);

    // סינון: לוקחים רק את האירועים שביקשת לשכפל
    const eventsToDuplicate = group.schedule.filter(evt => eventIds.includes(evt._id.toString()));

    if (eventsToDuplicate.length === 0) {
      return res.status(400).json({ message: 'לא נבחרו אירועים לשכפול' });
    }

    // יצירת העותקים
    const newEvents = eventsToDuplicate.map(evt => {
      return {
        title: evt.title,       // מעתיק שם
        startTime: evt.startTime, // מעתיק שעה
        endTime: evt.endTime,     // מעתיק שעת סיום
        hall: evt.hall,           // מעתיק אולם
        isMeal: evt.isMeal,       // מעתיק האם ארוחה
        notes: evt.notes,         // מעתיק הערות
        date: newDateObj,         // ✅ התאריך החדש
        eventType: evt.eventType  // מעתיק סוג
      };
    });

    // הוספה ללו"ז ושמירה
    group.schedule.push(...newEvents);
    await group.save();

    res.status(200).json(group); // מחזיר את הקבוצה המעודכנת
  } catch (error) {
    next(error);
  }
};

// --- עדכון פרטי קבוצה ---
export const updateGroupDetails = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        // תמיכה גם ב-id רגיל אם הראוט מוגדר אחרת
        const idToUpdate = groupId || req.params.id;
        const updates = req.body; 

        const group = await Group.findByIdAndUpdate(
            idToUpdate,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('schedule.hall');

        if (!group) return next(new AppError('Group not found', 404));
        res.json(group);
    } catch (err) { next(err); }
};

// --- מחיקת קבוצה ---
export const deleteGroup = async (req, res, next) => {
  try {
    // מנסה למצוא את ה-ID גם אם קראת לו id וגם אם groupId בראוטים
    const { id, groupId } = req.params;
    const idToDelete = id || groupId;

    const group = await Group.findByIdAndDelete(idToDelete);

    if (!group) {
      return next(new AppError('Group not found', 404));
    }

    res.status(200).json({ message: 'Group deleted successfully', id: idToDelete });
  } catch (err) { next(err); }
};

// --- הוספת אירוע לקבוצה ---
export const addEventToGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, date, startTime, endTime, hall, requirements, pax, eventType, mealType, kosherType, locationText } = req.body;

    // --- ביטול בדיקת חפיפות בצד שרת (האזהרה תוצג בקליינט) ---
    /*
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
    */

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

// --- עדכון אירוע קיים ---
export const updateGroupEvent = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const { title, date, startTime, endTime, hall, requirements, pax, eventType, mealType, kosherType, locationText } = req.body;

    // --- ביטול בדיקת חפיפות בצד שרת ---
    /*
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
    */

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

// --- מחיקת אירוע מקבוצה ---
export const removeEventFromGroup = async (req, res, next) => {
  try {
    const { groupId, eventId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return next(new AppError('Group not found', 404));
    
    group.schedule.pull({ _id: eventId });
    await group.save();
    const updated = await Group.findById(groupId).populate('schedule.hall');
    res.json(updated);
  } catch (err) { next(err); }
};

// --- דוח מטבח ---
export const getKitchenReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // מאריכים את טווח החיפוש ביום אחד קדימה
    const searchEnd = new Date(end);
    searchEnd.setDate(searchEnd.getDate() + 1);
    searchEnd.setHours(23, 59, 59, 999);

    const report = await Group.aggregate([
      // 1. סינון ראשוני רחב
      { $match: { "schedule.date": { $gte: start, $lte: searchEnd } } },
      { $unwind: "$schedule" },
      { $match: { "schedule.eventType": "meal" } },

      // 2. חישוב "יום עסקים"
      { $addFields: {
          "schedule.businessDate": {
            $cond: {
              if: { $lt: [ { $toInt: { $substrCP: ["$schedule.startTime", 0, 2] } }, 6 ] },
              then: { $subtract: ["$schedule.date", 24 * 60 * 60 * 1000] },
              else: "$schedule.date"
            }
          }
      }},

      // 3. סינון סופי
      { $match: { "schedule.businessDate": { $gte: start, $lte: end } } },

      // 4. הבאת פרטי אולם
      { $lookup: { from: "halls", localField: "schedule.hall", foreignField: "_id", as: "hallDetails" } },

      // 5. עיצוב התוצאה
      { $project: {
          groupName: "$name",
          contactPerson: "$contactPerson",
          title: "$schedule.title",
          originalDate: "$schedule.date",
          date: "$schedule.businessDate",
          startTime: "$schedule.startTime",
          endTime: "$schedule.endTime",
          pax: "$schedule.pax",
          price: "$schedule.price",
          mealType: "$schedule.mealType",
          kosherType: "$schedule.kosherType",
          requirements: "$schedule.requirements",
          hall: { $arrayElemAt: ["$hallDetails", 0] },
          locationText: "$schedule.locationText"
      }},

      // 6. מיון
      { $sort: { "date": 1, "startTime": 1 } }
    ]);

    res.json(report);
  } catch (err) { next(err); }
};

// --- דוח סיכום קבוצות ---
export const getGroupSummaryReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const searchEnd = new Date(end);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const report = await Group.aggregate([
      { $match: { "schedule.date": { $gte: start, $lte: searchEnd } } },
      { $unwind: "$schedule" },
      { $addFields: {
          businessDate: {
            $cond: {
              if: { $lt: [ { $toInt: { $substrCP: ["$schedule.startTime", 0, 2] } }, 6 ] },
              then: { $subtract: ["$schedule.date", 24 * 60 * 60 * 1000] },
              else: "$schedule.date"
            }
          }
      }},
      { $match: { businessDate: { $gte: start, $lte: end } } },
      
      { $group: {
          _id: "$name",
          totalEvents: { $sum: 1 },
          totalPax: { $sum: "$schedule.pax" },
          totalPrice: { $sum: "$schedule.price" },
          events: { $push: { 
            title: "$schedule.title", 
            date: "$businessDate",
            pax: "$schedule.pax" 
          }}
      }},
      { $sort: { totalPax: -1 } }
    ]);

    res.json(report);
  } catch (err) { next(err); }
};