import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Loader2, CalendarClock, X, Check,
  Pause, Play, Zap, TrendingUp
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const FREQ_LABELS = { daily: 'יומי', weekly: 'שבועי', monthly: 'חודשי', yearly: 'שנתי' };
const SUB_LABELS = {
  subscription: 'מנוי', bill: 'חשבון', salary: 'משכורת', rent: 'שכירות',
  insurance: 'ביטוח', loan_payment: 'הלוואה', savings: 'חיסכון', other: 'אחר',
};

export default function FinanceRecurringPage() {
  useSocket();
  const {
    recurring, recurringSummary, recurringLoading,
    fetchRecurring, addRecurring, updateRecurring, deleteRecurring, toggleRecurring,
    detectPatterns, getCashflow,
    categories, fetchCategories,
    setupSocketListeners, cleanupSocketListeners,
  } = useFinanceStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDetected, setShowDetected] = useState(false);
  const [detected, setDetected] = useState([]);
  const [cashflow, setCashflow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    description: '', amount: '', type: 'הוצאה', category: '',
    frequency: 'monthly', dayOfMonth: '', subcategory: 'bill', provider: '', notes: '',
  });

  useEffect(() => {
    fetchRecurring(); fetchCategories();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ description: '', amount: '', type: 'הוצאה', category: categories[0]?.name || '',
      frequency: 'monthly', dayOfMonth: '1', subcategory: 'bill', provider: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditingId(r._id);
    setForm({
      description: r.description, amount: String(r.amount), type: r.type,
      category: r.category || '', frequency: r.frequency, dayOfMonth: String(r.dayOfMonth || ''),
      subcategory: r.subcategory || 'other', provider: r.provider || '', notes: r.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    setSubmitting(true);
    try {
      const data = { ...form, amount: parseFloat(form.amount), dayOfMonth: parseInt(form.dayOfMonth) || 1 };
      if (editingId) {
        await updateRecurring(editingId, data);
        toast.success('עודכן');
      } else {
        await addRecurring(data);
        toast.success('נוסף');
      }
      setShowForm(false);
      fetchRecurring();
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteRecurring(id); toast.success('נמחק'); } catch { toast.error('שגיאה'); }
  };

  const handleToggle = async (id) => {
    try { await toggleRecurring(id); } catch { toast.error('שגיאה'); }
  };

  const handleDetect = async () => {
    try {
      const res = await detectPatterns();
      setDetected(res);
      setShowDetected(true);
    } catch { toast.error('שגיאה בזיהוי'); }
  };

  const handleCashflow = async () => {
    try { const res = await getCashflow(3); setCashflow(res); } catch { toast.error('שגיאה'); }
  };

  const activeRecurring = recurring.filter(r => r.isActive && !r.isPaused);
  const pausedRecurring = recurring.filter(r => r.isPaused);
  const inactiveRecurring = recurring.filter(r => !r.isActive);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex-1">הוצאות קבועות</h1>
            <button onClick={handleDetect} className="p-2 hover:bg-white/60 rounded-xl" title="זיהוי אוטומטי">
              <Zap size={18} className="text-amber-500" />
            </button>
            <button onClick={openAdd} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm hover:bg-blue-700">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {/* Summary */}
        {recurringSummary && (
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-purple-200/50">
            <p className="text-sm text-purple-100 mb-1">סה"כ חודשי</p>
            <p className="text-4xl font-bold tracking-tight mb-2">
              ₪{Math.round(recurringSummary.totalMonthly || 0).toLocaleString()}
            </p>
            <div className="flex gap-4 text-sm text-purple-100">
              <span>{recurringSummary.active || 0} פעילים</span>
              <span>₪{Math.round(recurringSummary.totalAnnual || 0).toLocaleString()} / שנה</span>
            </div>
          </div>
        )}

        {/* Cashflow button */}
        <button onClick={handleCashflow}
          className="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <TrendingUp size={16} className="text-blue-500" />
          תחזית תזרים מזומנים
        </button>

        {/* Cashflow results */}
        {cashflow && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">תחזית תזרים</h3>
            <div className="space-y-2">
              {cashflow.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{m.label}</span>
                  <div className="flex gap-3">
                    <span className="text-green-600">+₪{(m.income || 0).toLocaleString()}</span>
                    <span className="text-red-600">-₪{(m.expenses || 0).toLocaleString()}</span>
                    <span className={`font-bold ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₪{m.net?.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {recurringLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : recurring.length === 0 ? (
          <div className="text-center py-12">
            <CalendarClock size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-500">אין הוצאות קבועות</p>
            <p className="text-sm text-gray-400 mt-1">הוסיפו או זהו אוטומטית מההיסטוריה</p>
          </div>
        ) : (
          <>
            {/* Active */}
            {activeRecurring.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  פעילים ({activeRecurring.length})
                </h3>
                <div className="space-y-2">
                  {activeRecurring.map(r => (
                    <RecurringCard key={r._id} item={r} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}

            {/* Paused */}
            {pausedRecurring.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  מושהים ({pausedRecurring.length})
                </h3>
                <div className="space-y-2">
                  {pausedRecurring.map(r => (
                    <RecurringCard key={r._id} item={r} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detected patterns */}
      <AnimatePresence>
        {showDetected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setShowDetected(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">דפוסים שזוהו</h2>
                  <button onClick={() => setShowDetected(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                {detected.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">לא זוהו דפוסים חוזרים</p>
                ) : (
                  <div className="space-y-3">
                    {detected.map((d, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3">
                        <p className="font-medium text-sm">{d.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          ₪{d.avgAmount?.toLocaleString()} · {d.occurrences} פעמים · {d.category || 'כללי'}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              await addRecurring({
                                description: d.description, amount: d.avgAmount, type: 'הוצאה',
                                category: d.category || '', frequency: 'monthly',
                              });
                              toast.success('נוסף כקבוע');
                              fetchRecurring();
                            } catch { toast.error('שגיאה'); }
                          }}
                          className="mt-2 text-xs text-blue-600 font-medium"
                        >
                          הוסף כהוצאה קבועה
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add/Edit Form */}
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
                  <h2 className="text-lg font-bold">{editingId ? 'עריכה' : 'הוצאה קבועה חדשה'}</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {['הוצאה', 'הכנסה'].map(t => (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.type === t
                          ? (t === 'הוצאה' ? 'bg-red-600 text-white' : 'bg-green-600 text-white')
                          : 'bg-gray-100 text-gray-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="תיאור" className="w-full p-3.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />

                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-300">₪</span>
                    <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0" step="0.01" className="w-full p-3.5 pr-10 rounded-xl bg-gray-50 text-xl font-bold outline-none text-left" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                      className="p-3 rounded-xl bg-gray-50 text-sm outline-none">
                      {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input type="number" value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                      placeholder="יום בחודש" min="1" max="31"
                      className="p-3 rounded-xl bg-gray-50 text-sm outline-none text-left" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="p-3 rounded-xl bg-gray-50 text-sm outline-none">
                      <option value="">קטגוריה</option>
                      {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                      className="p-3 rounded-xl bg-gray-50 text-sm outline-none">
                      {Object.entries(SUB_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <input type="text" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    placeholder="ספק (לא חובה)" className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none" />

                  <button type="submit" disabled={submitting || !form.description.trim() || !form.amount}
                    className="w-full p-4 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    {editingId ? 'עדכן' : 'הוסף'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecurringCard({ item, onEdit, onDelete, onToggle }) {
  return (
    <motion.div layout className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-medium text-sm truncate ${item.isPaused ? 'text-gray-400 line-through' : ''}`}>{item.description}</p>
            {item.isPaused && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">מושהה</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {SUB_LABELS[item.subcategory] || 'אחר'} · {FREQ_LABELS[item.frequency] || item.frequency}
            {item.dayOfMonth ? ` · יום ${item.dayOfMonth}` : ''}
            {item.provider ? ` · ${item.provider}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${item.type === 'הכנסה' ? 'text-green-600' : 'text-red-600'}`}>
            ₪{item.amount?.toLocaleString()}
          </span>
          <button onClick={() => onToggle(item._id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            {item.isPaused ? <Play size={14} className="text-green-500" /> : <Pause size={14} className="text-yellow-500" />}
          </button>
          <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <CalendarClock size={14} className="text-gray-400" />
          </button>
          <button onClick={() => onDelete(item._id)} className="p-1.5 hover:bg-red-50 rounded-lg">
            <Trash2 size={14} className="text-gray-300 hover:text-red-500" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
