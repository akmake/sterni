import HouseholdExpense from '../models/HouseholdExpense.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const family = await Family.findOne({ 'members.user': userId });
  return family?._id;
};

// Get all expenses (optionally filter by month)
export const getExpenses = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const { month, year } = req.query;
    const filter = { family: familyId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const expenses = await HouseholdExpense.find(filter)
      .populate('paidBy', 'name')
      .sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add an expense
export const addExpense = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const { title, amount, category, date, notes } = req.body;
    if (!title?.trim() || !amount) return res.status(400).json({ error: 'כותרת וסכום נדרשים' });

    const expense = await HouseholdExpense.create({
      family: familyId,
      title: title.trim(),
      amount,
      category: category || 'other',
      paidBy: req.user._id,
      date: date || new Date(),
      notes: notes || ''
    });

    await expense.populate('paidBy', 'name');

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('expense:added', expense);
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an expense
export const updateExpense = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const expense = await HouseholdExpense.findOneAndUpdate(
      { _id: req.params.id, family: familyId },
      { ...req.body },
      { new: true }
    ).populate('paidBy', 'name');

    if (!expense) return res.status(404).json({ error: 'הוצאה לא נמצאה' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('expense:updated', expense);
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete an expense
export const deleteExpense = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const expense = await HouseholdExpense.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!expense) return res.status(404).json({ error: 'הוצאה לא נמצאה' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('expense:deleted', req.params.id);
    }

    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get expense summary by category
export const getExpenseSummary = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const { month, year } = req.query;
    const matchStage = { family: familyId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      matchStage.date = { $gte: start, $lte: end };
    }

    const summary = await HouseholdExpense.aggregate([
      { $match: matchStage },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    const total = summary.reduce((acc, s) => acc + s.total, 0);

    res.json({ summary, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
