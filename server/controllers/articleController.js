import { createRequire } from 'module';
import Article from '../models/Article.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Hebrew encoding fix — same map as AdminPage.jsx
const HEBREW_MAP = {
  0xe0:'א',0x2021:'א',0xe1:'ב',0x00B7:'ב',
  0xe2:'ג',0x201A:'ג',0xe3:'ד',0x201E:'ד',
  0xe4:'ה',0x2030:'ה',0xe5:'ו',0x00C2:'ו',
  0xe6:'ז',0x00CA:'ז',0xe7:'ח',0x00C1:'ח',
  0xe8:'ט',0x00CB:'ט',0xe9:'י',0x00C8:'י',
  0xC8:'י',0xea:'ך',0x00CD:'ך',0xCD:'ך',
  0xeb:'כ',0x00CE:'כ',0xec:'ל',0x00CF:'ל',
  0xCF:'ל',0xed:'ם',0x00CC:'ם',
  0xee:'מ',0x00D3:'מ',0xD3:'מ',
  0xef:'ן',0x00D4:'ן',
  0xf0:'נ',0xF8FF:'נ',
  0xf1:'ס',0x00D2:'ס',0xf2:'ע',0x00DA:'ע',
  0xf3:'ף',0x00DB:'ף',0xf4:'פ',0x00D9:'פ',0xD9:'פ',
  0xf5:'ץ',0x0131:'ץ',0xf6:'צ',0x02C6:'צ',
  0xf7:'ק',0x02DC:'ק',0xf8:'ר',0x00AF:'ר',
  0xf9:'ש',0x02D8:'ש',0xfa:'ת',0x02D9:'ת'
};
function fixHebrew(text) {
  return [...text].map(c => HEBREW_MAP[c.codePointAt(0)] ?? c).join('');
}

export const extractArticle = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'לא הועלה קובץ PDF' });
    const data = await pdfParse(req.file.buffer);
    const rawText = fixHebrew(data.text?.trim() || '');
    res.json({ rawText, pageCount: data.numpages });
  } catch (err) {
    next(err);
  }
};

// Text-only save (no PDF upload needed — used by Android local extraction)
export const saveArticleText = async (req, res, next) => {
  try {
    const { title, rawText, pageCount } = req.body;
    if (!rawText?.trim()) return res.status(422).json({ message: 'חסר טקסט' });
    const article = await Article.create({
      title:            title?.trim() || 'מאמר חדש',
      originalFilename: '',
      rawText:          rawText.trim(),
      pageCount:        parseInt(pageCount) || 0,
    });
    res.status(201).json(article);
  } catch (err) {
    next(err);
  }
};

export const uploadArticle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'לא הועלה קובץ PDF' });
    }

    const title = req.body.title?.trim() || req.file.originalname.replace(/\.pdf$/i, '');
    const rawText = req.body.rawText?.trim() || '';
    const pageCount = parseInt(req.body.pageCount) || 0;

    if (!rawText) {
      return res.status(422).json({ message: 'לא התקבל טקסט מהקובץ' });
    }

    const article = await Article.create({
      title,
      originalFilename: req.file.originalname,
      rawText,
      pageCount,
    });

    res.status(201).json(article);
  } catch (err) {
    next(err);
  }
};

export const getArticles = async (req, res, next) => {
  try {
    const articles = await Article.find({}, '-rawText').sort({ createdAt: -1 });
    res.json(articles);
  } catch (err) {
    next(err);
  }
};

export const getArticleById = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'מאמר לא נמצא' });
    res.json(article);
  } catch (err) {
    next(err);
  }
};

export const deleteArticle = async (req, res, next) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ message: 'מאמר לא נמצא' });
    res.json({ message: 'נמחק בהצלחה' });
  } catch (err) {
    next(err);
  }
};
export const updateArticle = async (req, res, next) => {
  try {
    const { title, rawText } = req.body;
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { title, rawText },
      { new: true }
    );
    if (!article) return res.status(404).json({ message: 'המאמר לא נמצא' });
    res.json(article);
  } catch (err) {
    next(err);
  }
};