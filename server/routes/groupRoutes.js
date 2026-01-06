import express from 'express';
import { 
    getKitchenReport,
    getGroupSummaryReport,
    getGroups,
    updateGroupEvent, 
    createGroup, 
    addEventToGroup, 
    removeEventFromGroup, 
    updateGroupDetails,
    deleteGroup // <-- 1. הוספנו את הייבוא של הפונקציה
} from '../controllers/groupController.js';

const router = express.Router();

// --- דוחות (חייבים להיות ראשונים!) ---
router.get('/reports/kitchen', getKitchenReport);
router.get('/reports/groups', getGroupSummaryReport);

// --- ראוטים כלליים ---
router.get('/', getGroups);
router.post('/', createGroup);

// --- ראוטים לפי ID של קבוצה ---
router.patch('/:groupId', updateGroupDetails);
router.delete('/:groupId', deleteGroup); // <-- 2. הנה התיקון! זה מה שהיה חסר לך

// --- ראוטים לאירועים בתוך קבוצה ---
router.post('/:groupId/events', addEventToGroup);
router.patch('/:groupId/events/:eventId', updateGroupEvent);
router.delete('/:groupId/events/:eventId', removeEventFromGroup);

export default router;