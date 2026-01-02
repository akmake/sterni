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

export const getKitchenReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // מאריכים את טווח החיפוש ביום אחד קדימה כדי לתפוס אירועים של הלילה (למשל 02:00 של מחר ששייך להיום)
    const searchEnd = new Date(end);
    searchEnd.setDate(searchEnd.getDate() + 1);
    searchEnd.setHours(23, 59, 59, 999);

    const report = await Group.aggregate([
      // 1. סינון ראשוני רחב
      { $match: { "schedule.date": { $gte: start, $lte: searchEnd } } },
      { $unwind: "$schedule" },
      { $match: { "schedule.eventType": "meal" } }, // סינון לארוחות בלבד (אפשר לשנות אם רוצים הכל)

      // 2. חישוב "יום עסקים" (Business Date)
      // אם השעה קטנה מ-06:00, נחשיב את זה כיום אחד אחורה
      { $addFields: {
          "schedule.businessDate": {
            $cond: {
              if: { $lt: [ { $toInt: { $substrCP: ["$schedule.startTime", 0, 2] } }, 6 ] },
              then: { $subtract: ["$schedule.date", 24 * 60 * 60 * 1000] }, // החסרת יום (במילישניות)
              else: "$schedule.date"
            }
          }
      }},

      // 3. סינון סופי לפי התאריך העסקי המבוקש
      { $match: { "schedule.businessDate": { $gte: start, $lte: end } } },

      // 4. הבאת פרטי אולם
      { $lookup: { from: "halls", localField: "schedule.hall", foreignField: "_id", as: "hallDetails" } },

      // 5. עיצוב התוצאה
      { $project: {
          groupName: "$name",
          contactPerson: "$contactPerson",
          title: "$schedule.title",
          originalDate: "$schedule.date",
          date: "$schedule.businessDate", // זה התאריך שיקבע באיזה יום זה יוצג
          startTime: "$schedule.startTime",
          endTime: "$schedule.endTime",
          pax: "$schedule.pax",
          price: "$schedule.price", // הוספת מחיר
          mealType: "$schedule.mealType",
          kosherType: "$schedule.kosherType",
          requirements: "$schedule.requirements",
          hall: { $arrayElemAt: ["$hallDetails", 0] },
          locationText: "$schedule.locationText"
      }},

      // 6. מיון לפי תאריך ושעה
      { $sort: { "date": 1, "startTime": 1 } }
    ]);

    res.json(report);
  } catch (err) { next(err); }
};

// --- פונקציה חדשה: דוח סיכום לפי קבוצות ---
export const getGroupSummaryReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // גם כאן נשתמש בלוגיקה של הרחבת הטווח
    const searchEnd = new Date(end);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const report = await Group.aggregate([
      { $match: { "schedule.date": { $gte: start, $lte: searchEnd } } },
      { $unwind: "$schedule" },
      // חישוב יום עסקים
      { $addFields: {
          businessDate: {
            $cond: {
              if: { $lt: [ { $toInt: { $substrCP: ["$schedule.startTime", 0, 2] } }, 6 ] },
              then: { $subtract: ["$schedule.date", 24 * 60 * 60 * 1000] },
              else: "$schedule.date"
            }
          }
      }},
      // סינון לפי הטווח המבוקש
      { $match: { businessDate: { $gte: start, $lte: end } } },
      
      // קיבוץ לפי שם הקבוצה
      { $group: {
          _id: "$name", // שם הקבוצה
          totalEvents: { $sum: 1 },
          totalPax: { $sum: "$schedule.pax" },
          totalPrice: { $sum: "$schedule.price" }, // סיכום כספי אם רלוונטי
          events: { $push: { 
            title: "$schedule.title", 
            date: "$businessDate",
            pax: "$schedule.pax" 
          }}
      }},
      { $sort: { totalPax: -1 } } // מיון לפי כמות אנשים יורדת
    ]);

    res.json(report);
  } catch (err) { next(err); }
};