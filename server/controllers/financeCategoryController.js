import FinanceCategory from '../models/FinanceCategory.js';
import FinanceCategoryRule from '../models/FinanceCategoryRule.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

// GET /api/finance/categories
export const getCategories = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });
    const categories = await FinanceCategory.find({ family: familyId }).sort({ name: 1 });
    res.json(categories);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/categories
export const createCategory = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { name, type, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם קטגוריה נדרש' });

    const cat = await FinanceCategory.create({
      family: familyId,
      name: name.trim(),
      type: type || 'הוצאה',
      color: color || '#64748b',
    });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:category:added', cat);
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'קטגוריה בשם זה כבר קיימת' });
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/finance/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const del = await FinanceCategory.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!del) return res.status(404).json({ error: 'לא נמצא' });

    await FinanceCategoryRule.deleteMany({ family: familyId, category: req.params.id });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:category:deleted', req.params.id);
    res.json({ message: 'נמחק' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/categories/sync
export const syncCategories = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const existing = await FinanceCategory.find({ family: familyId });
    const existingNames = new Set(existing.map(c => c.name));
    const defaults = ['מזון', 'דלק', 'סופר', 'משכנתא', 'חשמל', 'ארנונה', 'מים', 'תקשורת', 'ביטוח', 'רכב', 'בילויים', 'משכורת', 'הלוואות'];
    let added = 0;

    for (const name of defaults) {
      if (!existingNames.has(name)) {
        await FinanceCategory.create({
          family: familyId, name,
          type: name === 'משכורת' ? 'הכנסה' : 'הוצאה',
          color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        });
        added++;
      }
    }
    res.json({ message: `נוספו ${added} קטגוריות` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Rules ──
export const getRules = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });
    const rules = await FinanceCategoryRule.find({ family: familyId }).populate('category');
    res.json(rules);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createRule = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { searchString, matchType, newName, categoryId } = req.body;
    const rule = await FinanceCategoryRule.create({
      family: familyId,
      searchString, matchType: matchType || 'contains',
      newName: newName || null,
      category: categoryId,
    });
    const populated = await FinanceCategoryRule.findById(rule._id).populate('category');
    res.status(201).json(populated);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

export const deleteRule = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });
    await FinanceCategoryRule.findOneAndDelete({ _id: req.params.id, family: familyId });
    res.json({ message: 'נמחק' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const applyRules = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const rules = await FinanceCategoryRule.find({ family: familyId }).populate('category');
    let total = 0;

    for (const rule of rules) {
      const escaped = rule.searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(rule.matchType === 'starts_with' ? `^${escaped}` : escaped, 'i');

      const filter = {
        family: familyId,
        $or: [
          { rawDescription: { $regex: regex } },
          { rawDescription: { $in: [null, ''] }, description: { $regex: regex } }
        ]
      };

      if (rule.matchType === 'exact') {
        filter.$or = [
          { rawDescription: rule.searchString },
          { rawDescription: { $in: [null, ''] }, description: rule.searchString }
        ];
      }

      const categoryName = rule.category?.name || 'כללי';
      const update = { category: categoryName };
      if (rule.newName) update.description = rule.newName;

      const result = await FinanceTransaction.updateMany(filter, update);
      total += result.modifiedCount;
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:rules:applied');
    res.json({ message: `עודכנו ${total} עסקאות` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
