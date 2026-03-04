import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Loader2, Wallet,
  ChevronLeft, ChevronRight, X, TrendingUp, Tag, Settings2
} from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const DEFAULT_EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#9ca3af',
];

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export default function HouseholdExpensesPage() {
  const socket = useSocket();
  const {
    family, fetchFamily,
    expenses, expensesLoading, fetchExpenses,
    addExpense, deleteExpense,
    expenseSummary, fetchExpenseSummary,
    setupSocketListeners, cleanupSocketListeners,
    addCategory, removeCategory,
  } = useHouseholdStore();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const categories = family?.expenseCategories || [];

  const getCatColor = (catName) => {
    const idx = categories.findIndex(c => c.name === catName);
    const found = categories.find(c => c.name === catName);
    return found?.color || DEFAULT_EXPENSE_COLORS[idx % DEFAULT_EXPENSE_COLORS.length] || '#9ca3af';
  };

  useEffect(() => {
    fetchFamily();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name);
    }
  }, [categories.length]);

  useEffect(() => {
    fetchExpenses(month, year);
    fetchExpenseSummary(month, year);
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, [month, year]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    setSubmitting(true);
    try {
      await addExpense({
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        notes: notes.trim(),
      });
      setTitle('');
      setAmount('');
      setCategory(categories[0]?.name || '');
      setNotes('');
      setShowForm(false);
      toast.success('הוצאה נוספה!');
      // Refresh summary
      fetchExpenseSummary(month, year);
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      fetchExpenseSummary(month, year);
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const navigateMonth = (direction) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addCategory('expense', { name: newCategoryName.trim() });
      setNewCategoryName('');
      toast.success('קטגוריה נוספה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const handleRemoveCategory = async (catId) => {
    try {
      await removeCategory('expense', catId);
      toast.success('קטגוריה הוסרה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const totalAmount = expenseSummary?.total || 0;
  const maxCategory = expenseSummary?.summary?.[0];

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold">הוצאות משק בית</h1>
            </div>
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="p-2 hover:bg-white/60 rounded-xl transition-colors"
              title="ניהול קטגוריות"
            >
              <Settings2 size={18} className="text-gray-400" />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Category manager */}
          <AnimatePresence>
            {showCategoryManager && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 pb-2 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ניהול קטגוריות</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <span key={cat._id} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-xs border border-gray-100">
                        <Tag size={10} className="text-gray-400" />
                        {cat.name}
                        <button onClick={() => handleRemoveCategory(cat._id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddCategory} className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="קטגוריה חדשה..."
                      className="flex-1 bg-white p-2 rounded-lg text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium">
                      הוסף
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Month selector */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-white/60 rounded-lg">
              <ChevronRight size={18} className="text-gray-500" />
            </button>
            <span className="font-bold text-base min-w-[140px] text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-white/60 rounded-lg">
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50">
          <p className="text-sm text-blue-100 mb-1">סה״כ הוצאות החודש</p>
          <p className="text-4xl font-bold tracking-tight mb-3">
            ₪{totalAmount.toLocaleString()}
          </p>
          {maxCategory && (
            <div className="flex items-center gap-2 text-sm text-blue-100">
              <TrendingUp size={14} />
              <span>
                הכי הרבה: {maxCategory._id} — ₪{maxCategory.total.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        {expenseSummary?.summary?.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">פילוח לפי קטגוריה</h3>
            <div className="space-y-2.5">
              {expenseSummary.summary.map(s => {
                const color = getCatColor(s._id);
                const percent = totalAmount > 0 ? Math.round((s.total / totalAmount) * 100) : 0;
                return (
                  <div key={s._id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{s._id}</span>
                      </span>
                      <span className="font-bold">₪{s.total.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <form onSubmit={handleAdd} className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">הוצאה חדשה</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="על מה ההוצאה?"
                    className="w-full p-4 rounded-xl bg-gray-50 text-lg border-none outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />

                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0"
                      step="0.01"
                      className="w-full p-4 pr-12 rounded-xl bg-gray-50 text-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500/20 text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">קטגוריה</label>
                    <div className="grid grid-cols-4 gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => setCategory(cat.name)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs transition-all ${
                            category === cat.name
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          <span className="font-medium truncate w-full text-center">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="הערות (אופציונלי)"
                    className="w-full p-3 rounded-xl bg-gray-50 text-sm border-none outline-none focus:ring-2 focus:ring-blue-500/20"
                  />

                  <button
                    type="submit"
                    disabled={submitting || !title.trim() || !amount}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base transition-all disabled:opacity-50 hover:bg-blue-700"
                  >
                    {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'הוסף הוצאה'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Expenses List */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
        {expensesLoading && expenses.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Wallet size={32} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-400">אין הוצאות החודש</p>
            <p className="text-sm text-gray-300 mt-1">לחץ + להוספת הוצאה</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map(expense => {
              const color = getCatColor(expense.category);
              return (
                <motion.div
                  key={expense._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-transparent hover:border-gray-200 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: `${color}15`, color: color }}
                  >
                    {expense.category?.charAt(0) || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{expense.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-300">
                        {new Date(expense.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                      </span>
                      {expense.paidBy?.name && (
                        <span className="text-[10px] text-gray-300">
                          • {expense.paidBy.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-bold text-gray-800 text-sm" dir="ltr">
                    ₪{expense.amount.toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleDelete(expense._id)}
                    className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
