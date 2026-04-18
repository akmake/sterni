import express from 'express';
import { getNewsFeed, getArticle } from '../controllers/newsController.js';

const router = express.Router();

router.get('/feed', getNewsFeed);
router.get('/article', getArticle);

export default router;
