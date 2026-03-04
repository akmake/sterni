import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, TrendingDown, ArrowLeft,
  PiggyBank, CalendarClock, Target, BarChart3, Loader2,
  Upload, Tag
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function QuickCard({ icon: Icon, title, value, sub, color = 'blue', onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-right w-full"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl bg-${color}-50`}>
          <Icon size={18} className={`text-${color}-600`} />
        </div>
        <span className="text-xs font-medium text-gray-400">{title}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </motion.button>
  );
}

export default function FinanceDashboardPage() {
  useSocket();
  const navigate = useNavigate();
  const { dashboard, dashboardLoading, fetchDashboard, setupSocketListeners, cleanupSocketListeners } = useFinanceStore();

  useEffect(() => {
    fetchDashboard();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  if (dashboardLoading && !dashboard) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const d = dashboard || {};
  const monthly = d.monthly || {};
  const accounts = d.accounts || { total: 0, list: [] };
  const topCats = d.topCategories || [];
  const recent = d.recentTransactions || [];
  const chart = d.balanceChart || [];
  const budgetStatus = d.budget;
  const depositsSummary = d.deposits || {};
  const recurringInfo = d.recurring || {};

  const maxChartVal = Math.max(...chart.map(c => Math.max(c.income, c.expenses)), 1);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">כספים</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {/* Balance card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50">
          <p className="text-sm text-blue-100 mb-1">יתרה כוללת</p>
          <p className="text-4xl font-bold tracking-tight mb-3">
            ₪{accounts.total?.toLocaleString() || '0'}
          </p>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-green-200">
              <TrendingUp size={14} />
              <span>הכנסות: ₪{(monthly.income || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-200">
              <TrendingDown size={14} />
              <span>הוצאות: ₪{(monthly.expenses || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Quick nav grid */}
        <div className="grid grid-cols-2 gap-3">
          <QuickCard
            icon={Wallet}
            title="עסקאות החודש"
            value={monthly.transactionCount || 0}
            sub={`₪${(monthly.expenses || 0).toLocaleString()} הוצאות`}
            color="blue"
            onClick={() => navigate('/household/finance/transactions')}
          />
          <QuickCard
            icon={Target}
            title="תקציב"
            value={budgetStatus ? `${budgetStatus.percentUsed}%` : 'לא הוגדר'}
            sub={budgetStatus ? `₪${budgetStatus.remaining?.toLocaleString()} נותר` : 'הגדר תקציב'}
            color={budgetStatus?.isOverBudget ? 'red' : 'green'}
            onClick={() => navigate('/household/finance/budget')}
          />
          <QuickCard
            icon={CalendarClock}
            title="הוצאות קבועות"
            value={recurringInfo.count || 0}
            sub={`₪${(recurringInfo.monthlyTotal || 0).toLocaleString()} / חודש`}
            color="purple"
            onClick={() => navigate('/household/finance/recurring')}
          />
          <QuickCard
            icon={PiggyBank}
            title="חסכונות"
            value={depositsSummary.count || 0}
            sub={`₪${(depositsSummary.totalPrincipal || 0).toLocaleString()} קרן`}
            color="emerald"
            onClick={() => navigate('/household/finance/deposits')}
          />
        </div>

        {/* Balance chart */}
        {chart.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">הכנסות vs הוצאות</h3>
            <div className="flex items-end gap-1.5 h-32">
              {chart.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex gap-0.5 w-full items-end justify-center h-24">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(c.income / maxChartVal) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="w-3 bg-green-400 rounded-t-sm"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(c.expenses / maxChartVal) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="w-3 bg-red-400 rounded-t-sm"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 justify-center text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> הכנסות</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> הוצאות</span>
            </div>
          </div>
        )}

        {/* Top categories */}
        {topCats.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">קטגוריות מובילות</h3>
              <button onClick={() => navigate('/household/finance/analytics')} className="text-xs text-blue-600 font-medium">
                ניתוח מלא
              </button>
            </div>
            <div className="space-y-2">
              {topCats.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{cat.category}</span>
                    <span className="text-xs text-gray-400">{cat.percent}%</span>
                  </div>
                  <span className="font-bold">₪{cat.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {recent.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">עסקאות אחרונות</h3>
              <button onClick={() => navigate('/household/finance/transactions')} className="text-xs text-blue-600 font-medium">
                הצג הכל
              </button>
            </div>
            <div className="space-y-2">
              {recent.map((t) => (
                <div key={t._id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-gray-400">{t.category} · {new Date(t.date).toLocaleDateString('he-IL')}</p>
                  </div>
                  <span className={`font-bold text-sm ${t.type === 'הכנסה' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'הכנסה' ? '+' : '-'}₪{t.amount?.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'ניתוח חכם', icon: BarChart3, path: '/household/finance/analytics' },
              { label: 'ייבוא עסקאות', icon: Upload, path: '/household/finance/import' },
              { label: 'קטגוריות', icon: Tag, path: '/household/finance/categories' },
            ].map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <link.icon size={16} className="text-gray-400" />
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
