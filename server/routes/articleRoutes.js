import express from 'express';
import multer from 'multer';
import { extractArticle, uploadArticle, saveArticleText, getArticles, getArticleById, deleteArticle, updateArticle } from '../controllers/articleController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

router.post('/extract', upload.single('pdf'), extractArticle);
router.post('/upload',  upload.single('pdf'), uploadArticle);
router.post('/save',    saveArticleText); // text-only, no PDF
router.get('/', getArticles);
router.get('/:id', getArticleById);
router.put('/:id', updateArticle);
router.delete('/:id', deleteArticle);

export default router;
