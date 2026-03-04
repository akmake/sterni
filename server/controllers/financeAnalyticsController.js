import FinanceTransaction from '../models/FinanceTransaction.js';
import FinanceRecurring from '../models/FinanceRecurring.js';
import FinanceBudget from '../models/FinanceBudget.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

/* ========== HELPERS ========== */

const calcSummary = (transactions) => {
  let totalIncome = 0, totalExpenses = 0;
  const categoryMap = {};

  for (const t of transactions) {
    if (t.type === 'הכנסה') totalIncome += t.amount;
    else totalExpenses += t.amount;

    if (t.type === 'הוצאה') {
      const cat = t.category || 'כללי';
      categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
    }
  }

  return {
    totalIncome, totalExpenses,
    net: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    avgDailyExpense: 0,
    categoryBreakdown: categoryMap,
  };
};

const calcTrends = (transactions, months = 6) => {
  const now = new Date();
  const monthlyData = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const monthTxns = transactions.filter(t => t.date >= d && t.date <= end);

    const income = monthTxns.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxns.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);

    monthlyData.push({
      month: d.getMonth() + 1, year: d.getFullYear(),
      label: d.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' }),
      income, expenses, net: income - expenses,
    });
  }

  const expArr = monthlyData.map(m => m.expenses);
  const expTrend = expArr.length >= 2
    ? Math.round(((expArr[expArr.length - 1] - expArr[0]) / (expArr[0] || 1)) * 100)
    : 0;

  return { monthlyData, expenseTrend: expTrend };
};

const getTopCats = (transactions, limit = 10) => {
  const map = {};
  const expTxns = transactions.filter(t => t.type === 'הוצאה');

  for (const t of expTxns) {
    const cat = t.category || 'כללי';
    if (!map[cat]) map[cat] = { category: cat, total: 0, count: 0 };
    map[cat].total += t.amount;
    map[cat].count++;
  }

  const sorted = Object.values(map).sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, c) => s + c.total, 0);

  return sorted.slice(0, limit).map(c => ({
    ...c,
    percent: grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0,
    avgPerTransaction: c.count > 0 ? Math.round(c.total / c.count) : 0,
  }));
};

const detectAnomalies = (transactions) => {
  const catMonthly = {};
  const expTxns = transactions.filter(t => t.type === 'הוצאה');

  for (const t of expTxns) {
    const cat = t.category || 'כללי';
    const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
    if (!catMonthly[cat]) catMonthly[cat] = {};
    catMonthly[cat][key] = (catMonthly[cat][key] || 0) + t.amount;
  }

  const anomalies = [];
  for (const [cat, months] of Object.entries(catMonthly)) {
    const vals = Object.values(months);
    if (vals.length < 3) continue;

    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length);

    const last = vals[vals.length - 1];
    if (std > 0 && Math.abs(last - avg) > 1.5 * std) {
      anomalies.push({
        category: cat, currentMonth: last, average: Math.round(avg),
        deviation: Math.round(((last - avg) / avg) * 100),
        direction: last > avg ? 'עלייה' : 'ירידה',
      });
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
};

const generatePredictions = (transactions) => {
  const now = new Date();
  const monthlyExp = {};

  for (const t of transactions.filter(t => t.type === 'הוצאה')) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    monthlyExp[key] = (monthlyExp[key] || 0) + t.amount;
  }

  const keys = Object.keys(monthlyExp).sort();
  if (keys.length < 3) return { predictedExpenses: 0, confidence: 'low', trend: 'stable' };

  const last3 = keys.slice(-3).map(k => monthlyExp[k]);
  const avg = last3.reduce((s, v) => s + v, 0) / last3.length;

  const trend = last3[2] > last3[0] ? 'עולה' : last3[2] < last3[0] ? 'יורד' : 'יציב';

  return {
    predictedExpenses: Math.round(avg),
    confidence: keys.length >= 6 ? 'high' : keys.length >= 3 ? 'medium' : 'low',
    trend,
    basedOnMonths: last3.length,
  };
};

const calcEfficiency = (summary, budget) => {
  let score = 50;

  if (summary.savingsRate >= 20) score += 20;
  else if (summary.savingsRate >= 10) score += 10;
  else if (summary.savingsRate < 0) score -= 20;

  if (budget) {
    const pct = budget.totalLimit > 0 ? (budget.totalSpent / budget.totalLimit) * 100 : 100;
    if (pct <= 90) score += 15;
    else if (pct <= 100) score += 5;
    else score -= 15;
  }

  return Math.max(0, Math.min(100, score));
};

/* ========== CONTROLLERS ========== */

// GET /api/finance/analytics?months=6
export const getFinancialAnalytics = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const transactions = await FinanceTransaction.find({
      family: familyId, date: { $gte: start }
    }).sort({ date: -1 });

    const summary = calcSummary(transactions);
    const daysInRange = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    summary.avgDailyExpense = Math.round(summary.totalExpenses / daysInRange);

    const trends = calcTrends(transactions, months);
    const topCategories = getTopCats(transactions);
    const anomalies = detectAnomalies(transactions);
    const predictions = generatePredictions(transactions);

    const now = new Date();
    const budget = await FinanceBudget.findOne({
      family: familyId, month: now.getMonth() + 1, year: now.getFullYear()
    });
    const efficiencyScore = calcEfficiency(summary, budget);

    res.json({
      summary, trends, topCategories, anomalies, predictions,
      efficiencyScore,
      period: { months, from: start, to: new Date() },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/finance/analytics/insights
export const getInsights = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await FinanceTransaction.find({
      family: familyId, date: { $gte: sixMonthsAgo }
    }).sort({ date: -1 });

    const insights = [];

    // Largest expense
    const largest = transactions.filter(t => t.type === 'הוצאה').sort((a, b) => b.amount - a.amount)[0];
    if (largest) {
      insights.push({
        type: 'largest_expense', title: 'ההוצאה הגדולה ביותר',
        description: `${largest.description} - ${largest.amount.toLocaleString()} ש"ח`,
        date: largest.date,
      });
    }

    // Most frequent category
    const catCounts = {};
    for (const t of transactions.filter(t => t.type === 'הוצאה')) {
      catCounts[t.category || 'כללי'] = (catCounts[t.category || 'כללי'] || 0) + 1;
    }
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      insights.push({
        type: 'frequent_category', title: 'הקטגוריה הנפוצה',
        description: `${topCat[0]} - ${topCat[1]} עסקאות`,
      });
    }

    // Month-over-month change
    const now = new Date();
    const thisMonth = transactions.filter(t =>
      t.type === 'הוצאה' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()
    ).reduce((s, t) => s + t.amount, 0);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = transactions.filter(t =>
      t.type === 'הוצאה' && t.date.getMonth() === lastMonthDate.getMonth() && t.date.getFullYear() === lastMonthDate.getFullYear()
    ).reduce((s, t) => s + t.amount, 0);

    if (lastMonth > 0) {
      const change = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      insights.push({
        type: 'month_change', title: 'שינוי חודשי',
        description: `${change > 0 ? 'עלייה' : 'ירידה'} של ${Math.abs(change)}% בהוצאות לעומת חודש שעבר`,
        change,
      });
    }

    // Recurring cost summary
    const recurring = await FinanceRecurring.find({ family: familyId, isActive: true, isPaused: false });
    if (recurring.length > 0) {
      const monthlyRecurring = recurring.reduce((s, r) => s + (r.monthlyCost || 0), 0);
      insights.push({
        type: 'recurring_summary', title: 'הוצאות קבועות',
        description: `${recurring.length} הוצאות קבועות בסך ${Math.round(monthlyRecurring).toLocaleString()} ש"ח לחודש`,
        amount: monthlyRecurring,
      });
    }

    res.json(insights);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/finance/analytics/recommendations
export const getRecommendations = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [transactions, budget, recurring] = await Promise.all([
      FinanceTransaction.find({ family: familyId, date: { $gte: threeMonthsAgo } }),
      FinanceBudget.findOne({
        family: familyId, month: new Date().getMonth() + 1, year: new Date().getFullYear()
      }),
      FinanceRecurring.find({ family: familyId, isActive: true }),
    ]);

    const recs = [];

    // Budget overruns
    if (budget) {
      for (const item of budget.items) {
        if (item.spent > item.limit) {
          recs.push({
            type: 'budget_overrun', priority: 'high',
            title: `חריגה בקטגוריית ${item.category}`,
            description: `הוצאתם ${item.spent.toLocaleString()} מתוך ${item.limit.toLocaleString()} ש"ח`,
            action: 'בדקו את ההוצאות בקטגוריה זו',
          });
        }
      }
    }

    // Growing categories
    const catMonthly = {};
    for (const t of transactions.filter(t => t.type === 'הוצאה')) {
      const cat = t.category || 'כללי';
      const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
      if (!catMonthly[cat]) catMonthly[cat] = {};
      catMonthly[cat][key] = (catMonthly[cat][key] || 0) + t.amount;
    }

    for (const [cat, months] of Object.entries(catMonthly)) {
      const vals = Object.values(months);
      if (vals.length >= 2 && vals[vals.length - 1] > vals[0] * 1.3) {
        recs.push({
          type: 'growing_category', priority: 'medium',
          title: `עלייה בהוצאות ${cat}`,
          description: `ההוצאות בקטגוריה זו עלו בחודשים האחרונים`,
          action: 'שקלו להגדיר תקציב לקטגוריה זו',
        });
      }
    }

    // No budget set
    if (!budget) {
      recs.push({
        type: 'no_budget', priority: 'medium',
        title: 'אין תקציב חודשי',
        description: 'לא הוגדר תקציב לחודש הנוכחי',
        action: 'הגדירו תקציב חודשי למעקב טוב יותר',
      });
    }

    // Unused recurring
    const paused = await FinanceRecurring.find({ family: familyId, isPaused: true });
    if (paused.length > 0) {
      recs.push({
        type: 'paused_recurring', priority: 'low',
        title: `${paused.length} הוצאות קבועות מושהות`,
        description: 'ייתכן שכדאי לבטל אותן אם אינן נחוצות',
        action: 'בדקו את ההוצאות הקבועות המושהות',
      });
    }

    res.json(recs.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 2) - (p[b.priority] || 2);
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
};
