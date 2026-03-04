import FinanceTransaction from '../models/FinanceTransaction.js';
import FinanceAccount from '../models/FinanceAccount.js';
import FinanceRecurring from '../models/FinanceRecurring.js';
import FinanceBudget from '../models/FinanceBudget.js';
import FinanceDeposit from '../models/FinanceDeposit.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

// GET /api/finance/dashboard
export const getDashboardData = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      accounts,
      monthTransactions,
      recentTransactions,
      recurring,
      budget,
      deposits,
      allTransactions6m,
    ] = await Promise.all([
      FinanceAccount.find({ family: familyId }),
      FinanceTransaction.find({
        family: familyId, date: { $gte: startOfMonth, $lte: endOfMonth }
      }),
      FinanceTransaction.find({ family: familyId })
        .sort({ date: -1 }).limit(10)
        .populate('addedBy', 'name'),
      FinanceRecurring.find({ family: familyId, isActive: true, isPaused: false }),
      FinanceBudget.findOne({
        family: familyId, month: now.getMonth() + 1, year: now.getFullYear()
      }),
      FinanceDeposit.find({ family: familyId, status: 'active' }),
      FinanceTransaction.find({
        family: familyId, date: { $gte: sixMonthsAgo }
      }).sort({ date: 1 }),
    ]);

    // Account balances
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const accountSummary = accounts.map(a => ({ name: a.name, balance: a.balance }));

    // Monthly stats
    const monthlyIncome = monthTransactions.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
    const monthlyExpenses = monthTransactions.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);

    // Top categories this month
    const catMap = {};
    for (const t of monthTransactions.filter(t => t.type === 'הוצאה')) {
      const cat = t.category || 'כללי';
      catMap[cat] = (catMap[cat] || 0) + t.amount;
    }
    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, total]) => ({
        category, total,
        percent: monthlyExpenses > 0 ? Math.round((total / monthlyExpenses) * 100) : 0,
      }));

    // Balance chart (6 months)
    const balanceChart = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthTxns = allTransactions6m.filter(t => t.date >= d && t.date <= end);

      const inc = monthTxns.filter(t => t.type === 'הכנסה').reduce((s, t) => s + t.amount, 0);
      const exp = monthTxns.filter(t => t.type === 'הוצאה').reduce((s, t) => s + t.amount, 0);

      balanceChart.push({
        month: d.getMonth() + 1, year: d.getFullYear(),
        label: d.toLocaleDateString('he-IL', { month: 'short' }),
        income: inc, expenses: exp, net: inc - exp,
      });
    }

    // Recurring summary
    const monthlyRecurringCost = recurring.reduce((s, r) => s + (r.monthlyCost || 0), 0);

    // Budget status
    let budgetStatus = null;
    if (budget) {
      const spent = monthlyExpenses;
      budgetStatus = {
        totalLimit: budget.totalLimit,
        totalSpent: spent,
        percentUsed: budget.totalLimit > 0 ? Math.round((spent / budget.totalLimit) * 100) : 0,
        remaining: budget.totalLimit - spent,
        isOverBudget: spent > budget.totalLimit,
      };
    }

    // Deposits summary
    const depositsSummary = {
      totalPrincipal: deposits.reduce((s, d) => s + d.principal, 0),
      totalFutureValue: deposits.reduce((s, d) => s + (d.futureValue || d.principal), 0),
      count: deposits.length,
    };

    res.json({
      accounts: { total: totalBalance, list: accountSummary },
      monthly: {
        income: monthlyIncome, expenses: monthlyExpenses,
        net: monthlyIncome - monthlyExpenses,
        transactionCount: monthTransactions.length,
      },
      topCategories,
      recentTransactions,
      balanceChart,
      recurring: { count: recurring.length, monthlyTotal: Math.round(monthlyRecurringCost) },
      budget: budgetStatus,
      deposits: depositsSummary,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
