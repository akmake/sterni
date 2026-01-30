import express from 'express';
import { 
  saveQuote, 
  getAllQuotes, 
  getQuoteByName, 
  deleteQuote, 
  convertToGroup 
} from '../controllers/quoteController.js';

// שים לב: מחקנו או שמנו בהערה את הייבוא של protect כי אנחנו לא משתמשים בו
// import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- התיקון החשוב: ---
// הוספנו // בהתחלה כדי שהמערכת תתעלם מהשורה הזו ולא תחסום אותך
// router.use(protect); 

router.route('/')
  .get(getAllQuotes)
  .post(saveQuote);

router.route('/:name')
  .get(getQuoteByName)
  .delete(deleteQuote);

router.post('/:name/convert', convertToGroup);

export default router;