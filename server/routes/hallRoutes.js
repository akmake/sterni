import express from 'express';
import { getHalls, createHall, deleteHall } from '../controllers/hallController.js';

const router = express.Router();

router.get('/', getHalls);
router.post('/', createHall);
router.delete('/:id', deleteHall);

export default router;