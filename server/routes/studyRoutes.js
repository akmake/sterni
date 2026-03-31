import express from 'express';
import { getDailyStudy, getTehillimChapters } from '../controllers/studyController.js';

const router = express.Router();

router.get('/day', getDailyStudy);
router.get('/tehillim-chapters', getTehillimChapters);

export default router;
