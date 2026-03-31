import { Router } from 'express';
import { getZmanim } from '../controllers/zmanimController.js';

const router = Router();

router.get('/', getZmanim);

export default router;
