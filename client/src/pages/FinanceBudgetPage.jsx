import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Loader2, Target, X, Check,
  ChevronLeft, ChevronRight, Copy, AlertTriangle
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const COLORS = ['#3b82f6','#ef4444','#22c55e','#f97316','#8b5cf6','#ec4899','#14b8a6','#eab308','#6366f1','#9ca3af'];

export default function FinanceBudgetPage() {
  useSocket();
  const {
    budget, budgetSpending, budgetExists, budgetLoading,
    fetchBudget, upsertBudget, deleteBudget, copyBudget,
    categories, fetchCategories,
    setupSocketListeners, cleanupSocketListeners,
  } = useFinanceStore();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [totalLimit, setTotalLimit] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchCategories();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => { fetchBudget(month, year); }, [month, year]);

  const navigateMonth = (dir) => {
    let m = month + dir, y = year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const openEdit = () => {
    if (budget) {
      setTotalLimit(String(budget.totalLimit));
      setItems(budget.items.map((it, i) => ({ category: it.category, limit: String(it.limit), color: it.color || COLORS[i % COLORS.length] })));
    } else {
      setTotalLimit('');
      setItems([{ category: categories[0]?.name || '', limit: '', color: COLORS[0] }]);
    }
    setShowForm(true);
  };

  const addItem = () => {
    setItems(prev => [...prev, { category: '', limit: '', color: COLORS[prev.length % COLORS.length] }]);
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!totalLimit || items.length === 0) return;
    setSubmitting(true);
    try {
      await upsertBudget({ month, year, totalLimit, items });
      setShowForm(false);
      toast.success('תקציב נשמר');
      fetchBudget(month, year);
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!budget?._id) return;
    if (!confirm('למחוק את התקציב?')) return;
    try { await deleteBudget(budget._id); toast.success('נמחק'); } catch { toast.error('שגיאה'); }
  };

  const handleCopy = async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    try {
      await copyBudget({ fromMonth: prevMonth, fromYear: prevYear, toMonth: month, toYear: year });
      toast.success('תקציב הועתק');
      fetchBudget(month, year);
      setShowCopy(false);
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const budgetItems = budget?.items || [];
  const totalSpent = budget?.totalSpent || 0;
  const percentUsed = budget?.totalLimit > 0 ? Math.round((totalSpent / budget.totalLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex-1">תקציב</h1>
            {!budgetExists && (
              <button onClick={() => setShowCopy(true)} className="p-2 hover:bg-white/60 rounded-xl" title="העתק מחודש קודם">
                <Copy size={18} className="text-gray-400" />
              </button>
            )}
            <button onClick={openEdit} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition-colors">
              {budgetExists ? <Edit2 size={18} /> : <Plus size={18} />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-white/60 rounded-lg">
              <ChevronRight size={18} className="text-gray-500" />
            </button>
            <span className="font-bold text-base min-w-[140px] text-center">{MONTHS[month - 1]} {year}</span>
            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-white/60 rounded-lg">
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {budgetLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : !budgetExists ? (
          <div className="text-center py-12">
            <Target size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-500">אין תקציב לחודש זה</p>
            <p className="text-sm text-gray-400 mt-1">הגדירו תקציב לחודש או העתיקו מחודש קודם</p>
            <button onClick={openEdit} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
              הגדר תקציב
            </button>
          </div>
        ) : (
          <>
            {/* Overall progress */}
            <div className={`rounded-2xl p-5 text-white shadow-lg ${percentUsed > 100 ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-red-200/50' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-200/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/80">ניצול תקציב</p>
                {percentUsed > 100 && <AlertTriangle size={18} className="text-yellow-200" />}
              </div>
              <p className="text-4xl font-bold mb-1">{percentUsed}%</p>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentUsed, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${percentUsed > 100 ? 'bg-yellow-300' : 'bg-white'}`}
                />
              </div>
              <div className="flex justify-between text-sm text-white/80">
                <span>₪{totalSpent.toLocaleString()} מתוך ₪{budget.totalLimit.toLocaleString()}</span>
                <span>נותר: ₪{(budget.totalLimit - totalSpent).toLocaleString()}</span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">פירוט לפי קטגוריה</h3>
              <div className="space-y-3">
                {budgetItems.map((item, i) => {
                  const pct = item.limit > 0 ? Math.round((item.spent / item.limit) * 100) : 0;
                  const isOver = item.spent > item.limit;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{item.category}</span>
                        <span className={`text-xs font-bold ${isOver ? 'text-red-600' : 'text-gray-500'}`}>
                          ₪{(item.spent || 0).toLocaleString()} / ₪{item.limit.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: isOver ? '#ef4444' : (item.color || COLORS[i % COLORS.length]) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={handleDelete} className="w-full p-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              מחק תקציב
            </button>
          </>
        )}
      </div>

      {/* Budget Form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">הגדרת תקציב - {MONTHS[month - 1]} {year}</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">תקציב כולל</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-300">₪</span>
                      <input type="number" value={totalLimit} onChange={e => setTotalLimit(e.target.value)}
                        placeholder="0" className="w-full p-3 pr-10 rounded-xl bg-gray-50 text-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 text-left" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-600">קטגוריות</label>
                      <button type="button" onClick={addItem} className="text-xs text-blue-600 font-medium">+ הוסף</button>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}
                            className="flex-1 p-2.5 rounded-lg bg-gray-50 text-sm outline-none">
                            <option value="">בחר קטגוריה</option>
                            {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                          </select>
                          <input type="number" value={item.limit} onChange={e => updateItem(i, 'limit', e.target.value)}
                            placeholder="תקציב" className="w-24 p-2.5 rounded-lg bg-gray-50 text-sm text-left outline-none" />
                          <button type="button" onClick={() => removeItem(i)} className="p-1.5 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} className="text-gray-300 hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={submitting || !totalLimit || items.length === 0}
                    className="w-full p-4 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    שמור תקציב
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Copy dialog */}
      <AnimatePresence>
        {showCopy && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setShowCopy(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center p-6"
            >
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 className="text-lg font-bold mb-2">העתקת תקציב</h3>
                <p className="text-sm text-gray-500 mb-4">
                  להעתיק את התקציב מ{MONTHS[month === 1 ? 11 : month - 2]} ל{MONTHS[month - 1]}?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowCopy(false)} className="flex-1 p-3 rounded-xl bg-gray-100 text-gray-600 font-medium">
                    ביטול
                  </button>
                  <button onClick={handleCopy} className="flex-1 p-3 rounded-xl bg-blue-600 text-white font-medium">
                    העתק
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Edit2(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
  );
}
