import FinanceRecurring from '../models/FinanceRecurring.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

const calcNext = (rec, fromDate = new Date()) => {
  const d = new Date(fromDate);
  switch (rec.frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': {
      d.setMonth(d.getMonth() + 1);
      if (rec.dayOfMonth) {
        const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(rec.dayOfMonth, max));
      }
      break;
    }
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d;
};

// GET /api/finance/recurring
export const getRecurringTransactions = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const filter = { family: familyId };
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    if (req.query.type) filter.type = req.query.type;

    const transactions = await FinanceRecurring.find(filter).sort({ nextExecution: 1 });

    const activeExpenses = transactions.filter(t => t.isActive && t.type === 'הוצאה' && !t.isPaused);
    const activeIncome = transactions.filter(t => t.isActive && t.type === 'הכנסה' && !t.isPaused);

    const summary = {
      totalMonthlyExpenses: activeExpenses.reduce((s, t) => s + (t.monthlyCost || 0), 0),
      totalMonthlyIncome: activeIncome.reduce((s, t) => s + (t.monthlyCost || 0), 0),
      totalAnnualExpenses: activeExpenses.reduce((s, t) => s + (t.annualCost || 0), 0),
      totalAnnualIncome: activeIncome.reduce((s, t) => s + (t.annualCost || 0), 0),
      activeCount: transactions.filter(t => t.isActive).length,
      pausedCount: transactions.filter(t => t.isPaused).length,
    };

    res.json({ transactions, summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/recurring
export const addRecurringTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { description, amount, type, category, account, frequency, dayOfMonth, dayOfWeek,
      startDate, endDate, subcategory, provider, notes, remindDaysBefore } = req.body;

    if (!description || !amount || !type || !startDate) {
      return res.status(400).json({ error: 'תיאור, סכום, סוג ותאריך התחלה נדרשים' });
    }

    const data = {
      family: familyId, addedBy: req.user._id,
      description, amount: Math.abs(Number(amount)), type,
      category: category || 'כללי', account: account || 'checking',
      frequency: frequency || 'monthly', dayOfMonth, dayOfWeek,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      subcategory: subcategory || 'other', provider, notes,
      remindDaysBefore: remindDaysBefore || 0,
    };
    data.nextExecution = calcNext(data, new Date(startDate));

    const tx = await FinanceRecurring.create(data);
    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:recurring:added', tx);
    res.status(201).json(tx);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PUT /api/finance/recurring/:id
export const updateRecurringTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const tx = await FinanceRecurring.findOne({ _id: req.params.id, family: familyId });
    if (!tx) return res.status(404).json({ error: 'לא נמצא' });

    const allowed = ['description', 'amount', 'type', 'category', 'account', 'frequency',
      'dayOfMonth', 'dayOfWeek', 'startDate', 'endDate', 'isActive', 'isPaused',
      'subcategory', 'provider', 'notes', 'remindDaysBefore'];

    for (const f of allowed) {
      if (req.body[f] !== undefined) tx[f] = req.body[f];
    }
    if (req.body.amount) tx.amount = Math.abs(Number(req.body.amount));
    if (req.body.frequency || req.body.startDate) tx.nextExecution = calcNext(tx);

    await tx.save();
    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:recurring:updated', tx);
    res.json(tx);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/finance/recurring/:id
export const deleteRecurringTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const tx = await FinanceRecurring.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!tx) return res.status(404).json({ error: 'לא נמצא' });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:recurring:deleted', req.params.id);
    res.json({ message: 'נמחק' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/recurring/:id/toggle
export const toggleRecurring = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const tx = await FinanceRecurring.findOne({ _id: req.params.id, family: familyId });
    if (!tx) return res.status(404).json({ error: 'לא נמצא' });

    tx.isPaused = !tx.isPaused;
    await tx.save();

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:recurring:updated', tx);
    res.json({ message: tx.isPaused ? 'הושהה' : 'הופעל', transaction: tx });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/finance/recurring/detect
export const detectPatterns = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const [allTxns, existingRecurring] = await Promise.all([
      FinanceTransaction.find({ family: familyId, date: { $gte: sixMonthsAgo } })
        .select('description rawDescription amount type category date').lean(),
      FinanceRecurring.find({ family: familyId }).select('description amount').lean(),
    ]);

    const existingDesc = new Set(existingRecurring.map(r => r.description.trim().toLowerCase()));
    const groups = {};
    for (const tx of allTxns) {
      const key = tx.description.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }

    const candidates = [];
    for (const [key, txns] of Object.entries(groups)) {
      if (existingDesc.has(key) || txns.length < 2) continue;
      const months = new Set(txns.map(t => { const d = new Date(t.date); return `${d.getFullYear()}-${d.getMonth()}`; }));
      if (months.size < 2) continue;

      const amounts = txns.map(t => t.amount);
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      if (!amounts.every(a => Math.abs(a - avg) / avg <= 0.15)) continue;

      const days = txns.map(t => new Date(t.date).getDate());
      const dayFreq = {};
      days.forEach(d => { dayFreq[d] = (dayFreq[d] || 0) + 1; });
      const [dominantDay, dayCount] = Object.entries(dayFreq).sort(([, a], [, b]) => b - a)[0];

      const confidence = Math.min(1, (months.size / 6) * 0.6 + (dayCount / txns.length) * 0.4);
      candidates.push({
        description: txns[0].description,
        amount: Math.round(avg * 100) / 100,
        type: txns[0].type,
        category: txns[0].category || 'כללי',
        occurrenceCount: txns.length,
        suggestedDay: parseInt(dominantDay),
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    res.json({ candidates: candidates.slice(0, 20) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/finance/recurring/cashflow?months=3
export const getCashflowForecast = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const months = parseInt(req.query.months) || 3;
    const active = await FinanceRecurring.find({ family: familyId, isActive: true, isPaused: false });

    const forecast = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < months; i++) {
      const month = new Date(today);
      month.setMonth(month.getMonth() + i);
      let income = 0, expenses = 0;

      for (const t of active) {
        if (t.endDate && month > t.endDate) continue;
        if (month < t.startDate) continue;
        const mc = t.monthlyCost || 0;
        if (t.type === 'הכנסה') income += mc; else expenses += mc;
      }

      forecast.push({
        month: month.getMonth() + 1,
        year: month.getFullYear(),
        income: Math.round(income),
        expenses: Math.round(expenses),
        net: Math.round(income - expenses),
      });
    }

    res.json({ forecast });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
