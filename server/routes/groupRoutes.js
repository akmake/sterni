import express from 'express';
import { getKitchenReport,getGroupSummaryReport,getGroups,updateGroupEvent, createGroup, addEventToGroup, removeEventFromGroup, updateGroupDetails } from '../controllers/groupController.js';

const router = express.Router();

router.get('/', getGroups);
router.post('/', createGroup);
router.patch('/:groupId', updateGroupDetails); // <-- נתיב חדש לעדכון פרטים

router.post('/:groupId/events', addEventToGroup);
router.patch('/:groupId/events/:eventId', updateGroupEvent); // <-- נתיב חדש לעריכה
router.delete('/:groupId/events/:eventId', removeEventFromGroup);
router.get('/reports/kitchen', getKitchenReport); // <-- הוסף את השורה הזו לפני הנתיבים עם :id
router.get('/reports/groups', getGroupSummaryReport); // <-- הוסף שורה זו
export default router;