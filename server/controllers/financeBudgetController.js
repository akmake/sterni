import FinanceBudget from '../models/FinanceBudget.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

const calcSpending = async (familyId, month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const agg = await FinanceTransaction.aggregate([
    { $match: { family: familyId, type: 'הוצאה', date: { $gte: start, $lte: end } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } }
  ]);

  return agg.reduce((m, i) => { m[i._id] = i.total; return m; }, {});
};

// GET /api/finance/budgets?month=&year=
export const getBudget = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year) || new Date().getFullYear();

    let budget = await FinanceBudget.findOne({ family: familyId, month: m, year: y });
    if (!budget) return res.json({ budget: null, spending: {}, exists: false });

    const spending = await calcSpending(familyId, m, y);
    let totalSpent = 0;

    budget.items = budget.items.map(item => {
      const spent = spending[item.category] || 0;
      item.spent = spent;
      totalSpent += spent;
      return item;
    });

    const budgetCategories = new Set(budget.items.map(i => i.category));
    const uncategorizedSpending = {};
    for (const [cat, amount] of Object.entries(spending)) {
      if (!budgetCategories.has(cat)) {
        uncategorizedSpending[cat] = amount;
        totalSpent += amount;
      }
    }

    budget.totalSpent = totalSpent;
    await budget.save();

    res.json({ budget, spending, uncategorizedSpending, exists: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/budgets
export const upsertBudget = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { month, year, totalLimit, items, alertThreshold, notes } = req.body;
    if (!month || !year || !totalLimit) return res.status(400).json({ error: 'חודש, שנה ותקציב נדרשים' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'יש להוסיף קטגוריה אחת לפחות' });

    const data = {
      family: familyId,
      month: parseInt(month), year: parseInt(year),
      totalLimit: Number(totalLimit),
      items: items.map(i => ({ category: i.category, limit: Number(i.limit), color: i.color || '#3b82f6' })),
      alertThreshold: alertThreshold || 80,
      notes: notes || '',
    };

    const budget = await FinanceBudget.findOneAndUpdate(
      { family: familyId, month: data.month, year: data.year },
      data,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:budget:updated', budget);
    res.status(201).json(budget);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/finance/budgets/:id
export const deleteBudget = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const b = await FinanceBudget.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!b) return res.status(404).json({ error: 'לא נמצא' });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:budget:deleted', req.params.id);
    res.json({ message: 'נמחק' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/budgets/copy
export const copyBudget = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { fromMonth, fromYear, toMonth, toYear } = req.body;
    const source = await FinanceBudget.findOne({ family: familyId, month: parseInt(fromMonth), year: parseInt(fromYear) });
    if (!source) return res.status(404).json({ error: 'תקציב מקור לא נמצא' });

    const existing = await FinanceBudget.findOne({ family: familyId, month: parseInt(toMonth), year: parseInt(toYear) });
    if (existing) return res.status(409).json({ error: 'כבר קיים תקציב לחודש היעד' });

    const newBudget = await FinanceBudget.create({
      family: familyId,
      month: parseInt(toMonth), year: parseInt(toYear),
      totalLimit: source.totalLimit,
      items: source.items.map(i => ({ category: i.category, limit: i.limit, color: i.color })),
      alertThreshold: source.alertThreshold,
    });

    res.status(201).json(newBudget);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/finance/budgets/summary?year=
export const getBudgetSummary = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const year = parseInt(req.query.year) || new Date().getFullYear();
    const budgets = await FinanceBudget.find({ family: familyId, year }).sort({ month: 1 });

    const monthlySummary = [];
    for (const budget of budgets) {
      const spending = await calcSpending(familyId, budget.month, year);
      const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);
      monthlySummary.push({
        month: budget.month, totalLimit: budget.totalLimit, totalSpent,
        percentUsed: budget.totalLimit > 0 ? Math.round((totalSpent / budget.totalLimit) * 100) : 0,
        remaining: budget.totalLimit - totalSpent,
        isOverBudget: totalSpent > budget.totalLimit,
      });
    }

    res.json({
      monthlySummary,
      yearTotal: {
        totalLimit: monthlySummary.reduce((s, m) => s + m.totalLimit, 0),
        totalSpent: monthlySummary.reduce((s, m) => s + m.totalSpent, 0),
        monthsOverBudget: monthlySummary.filter(m => m.isOverBudget).length,
        monthsTracked: monthlySummary.length,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
