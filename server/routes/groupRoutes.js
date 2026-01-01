import express from 'express';
import { getGroups, createGroup, addEventToGroup, removeEventFromGroup, updateGroupDetails } from '../controllers/groupController.js';

const router = express.Router();

router.get('/', getGroups);
router.post('/', createGroup);
router.patch('/:groupId', updateGroupDetails); // <-- נתיב חדש לעדכון פרטים

router.post('/:groupId/events', addEventToGroup);
router.delete('/:groupId/events/:eventId', removeEventFromGroup);

export default router;