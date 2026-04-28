import express from 'express';
import { renderQuotePdf } from '../controllers/quotePdfController.js';

const router = express.Router();

router.post('/render', renderQuotePdf);

export default router;
