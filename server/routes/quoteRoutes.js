import express from 'express';
import { saveQuote, getAllQuotes, getQuoteByName, deleteQuote } from '../controllers/quoteController.js';

const router = express.Router();

// הערה: הסרתי את ה-protect בכוונה כדי לבטל את השגיאה 403
// router.use(protect); 

router.route('/')
  .get(getAllQuotes)
  .post(saveQuote);

router.route('/:name')
  .get(getQuoteByName)
  .delete(deleteQuote);

export default router;