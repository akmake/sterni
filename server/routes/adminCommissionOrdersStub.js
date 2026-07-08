import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';

// Stub עבור מחולל דוחות העמלות (CommissionGenerator).
// זיהוי חלוקת אחוזים (יוצר/סוגר) מושבת בכוונה: מי שההזמנה רשומה על שמו
// מקבל את מלוא העמלה. מפה ריקה => כל שורה מטופלת כלא-מפוצלת.
const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

// מפת פיצול ריקה => אין חלוקת אחוזים.
router.get('/commission-map', (req, res) => res.json({}));

// אין מסד הזמנות באפליקציה הזו; המחולל נשען על העלאת קבצי אקסל.
router.get('/', (req, res) => res.json([]));

export default router;
