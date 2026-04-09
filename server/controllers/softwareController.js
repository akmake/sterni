import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import AppError from '../utils/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOFTWARE_DIR = path.join(__dirname, '../../uploads/software');
const LIBRARY_FILE = path.join(SOFTWARE_DIR, 'library.json');

// ─── קריאה/כתיבה library.json ─────────────────────────────────────────────────
function readLibrary() {
  try {
    if (!fs.existsSync(LIBRARY_FILE)) return { categories: [], items: [] };
    const raw = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    // תאימות אחורה: אם הקובץ הוא מערך ישן
    if (Array.isArray(raw)) return { categories: [], items: raw };
    return { categories: raw.categories || [], items: raw.items || [] };
  } catch {
    return { categories: [], items: [] };
  }
}

function writeLibrary(data) {
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function canModify(item, user) {
  const isOwner = item.uploadedBy?._id?.toString() === user._id.toString();
  return isOwner || user.role === 'admin';
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const getCategories = (req, res, next) => {
  try {
    const lib = readLibrary();
    res.json({ status: 'success', data: lib.categories });
  } catch (err) { next(err); }
};

export const createCategory = (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return next(new AppError('שם קטגוריה חובה', 400));

    const lib = readLibrary();
    if (lib.categories.some(c => c.name === name.trim())) {
      return next(new AppError('קטגוריה בשם זה כבר קיימת', 400));
    }

    const cat = { name: name.trim(), color: color || '#6B7280' };
    lib.categories.push(cat);
    writeLibrary(lib);

    res.status(201).json({ status: 'success', data: cat });
  } catch (err) { next(err); }
};

export const deleteCategory = (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const lib = readLibrary();
    const idx = lib.categories.findIndex(c => c.name === name);
    if (idx === -1) return next(new AppError('קטגוריה לא נמצאה', 404));

    lib.categories.splice(idx, 1);
    // מאפס קטגוריה בתוכנות שהשתמשו בה
    lib.items = lib.items.map(i => i.category === name ? { ...i, category: '' } : i);
    writeLibrary(lib);

    res.json({ status: 'success', message: 'קטגוריה נמחקה' });
  } catch (err) { next(err); }
};

// ─── ITEMS ────────────────────────────────────────────────────────────────────
export const getAllSoftware = (req, res, next) => {
  try {
    const { category, search } = req.query;
    let { items } = readLibrary();

    if (category) items = items.filter(i => i.category === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q) ||
        i.installSteps?.some(s => s.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ status: 'success', data: items });
  } catch (err) { next(err); }
};

export const getSoftware = (req, res, next) => {
  try {
    const item = readLibrary().items.find(i => i.id === req.params.id);
    if (!item) return next(new AppError('תוכנה לא נמצאה', 404));
    res.json({ status: 'success', data: item });
  } catch (err) { next(err); }
};

export const uploadSoftware = (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('לא הועלה קובץ', 400));

    const { title, description, version, category, notes } = req.body;
    if (!title?.trim()) {
      fs.unlink(req.file.path, () => {});
      return next(new AppError('שם התוכנה הוא שדה חובה', 400));
    }

    const originalFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const newItem = {
      id: randomUUID(),
      title: title.trim(),
      description: description?.trim() || '',
      version: version?.trim() || '',
      category: category || '',
      notes: notes?.trim() || '',
      installSteps: [],
      filename: req.file.filename,
      originalFilename,
      url: `/uploads/software/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: { _id: req.user._id.toString() },
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const lib = readLibrary();
    lib.items.push(newItem);
    writeLibrary(lib);

    res.status(201).json({ status: 'success', data: newItem });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
};

export const updateSoftware = (req, res, next) => {
  try {
    const lib = readLibrary();
    const idx = lib.items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return next(new AppError('תוכנה לא נמצאה', 404));

    const item = lib.items[idx];
    if (!canModify(item, req.user)) return next(new AppError('אין הרשאה לעריכה', 403));

    const { title, description, version, category, notes, installSteps } = req.body;
    if (title?.trim())        item.title        = title.trim();
    if (description !== undefined) item.description = description.trim();
    if (version !== undefined)     item.version     = version.trim();
    if (category !== undefined)    item.category    = category;
    if (notes !== undefined)       item.notes       = notes.trim();
    if (Array.isArray(installSteps)) item.installSteps = installSteps.map(s => s.trim()).filter(Boolean);
    item.updatedAt = new Date().toISOString();

    lib.items[idx] = item;
    writeLibrary(lib);
    res.json({ status: 'success', data: item });
  } catch (err) { next(err); }
};

export const deleteSoftware = (req, res, next) => {
  try {
    const lib = readLibrary();
    const idx = lib.items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return next(new AppError('תוכנה לא נמצאה', 404));

    const item = lib.items[idx];
    if (!canModify(item, req.user)) return next(new AppError('אין הרשאה למחיקה', 403));

    const filePath = path.join(SOFTWARE_DIR, item.filename);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('⚠️ לא ניתן למחוק קובץ:', filePath, err.message);
    });

    lib.items.splice(idx, 1);
    writeLibrary(lib);
    res.json({ status: 'success', message: 'התוכנה נמחקה' });
  } catch (err) { next(err); }
};

export const downloadSoftware = (req, res, next) => {
  try {
    const lib = readLibrary();
    const idx = lib.items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return next(new AppError('תוכנה לא נמצאה', 404));

    const item = lib.items[idx];
    const filePath = path.join(SOFTWARE_DIR, item.filename);
    if (!fs.existsSync(filePath)) return next(new AppError('הקובץ לא נמצא בשרת', 404));

    lib.items[idx].downloadCount = (item.downloadCount || 0) + 1;
    writeLibrary(lib);

    res.download(filePath, item.originalFilename);
  } catch (err) { next(err); }
};
