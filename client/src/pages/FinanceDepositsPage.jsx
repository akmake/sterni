import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Loader2, PiggyBank, X, Check,
  AlertCircle, TrendingUp, Calendar
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const STATUS_LABELS = { active: 'פעיל', broken: 'נשבר', matured: 'נפדה' };
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', broken: 'bg-red-100 text-red-700', matured: 'bg-blue-100 text-blue-700' };

export default function FinanceDepositsPage() {
  useSocket();
  const {
    deposits, depositsSummary, depositsLoading,
    fetchDeposits, addDeposit, breakDeposit, matureDeposit, deleteDeposit,
    setupSocketListeners, cleanupSocketListeners,
  } = useFinanceStore();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', principal: '', annualInterestRate: '',
    startDate: '', endDate: '', sourceAccount: '',
  });

  useEffect(() => {
    fetchDeposits();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.principal || !form.annualInterestRate || !form.startDate || !form.endDate) return;
    setSubmitting(true);
    try {
      await addDeposit({
        ...form,
        principal: parseFloat(form.principal),
        annualInterestRate: parseFloat(form.annualInterestRate),
      });
      setShowForm(false);
      setForm({ name: '', principal: '', annualInterestRate: '', startDate: '', endDate: '', sourceAccount: '' });
      toast.success('פקדון נוסף');
      fetchDeposits();
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally { setSubmitting(false); }
  };

  const handleBreak = async (id) => {
    if (!confirm('לשבור את הפקדון? הקרן תחזור לחשבון.')) return;
    try { await breakDeposit(id); toast.success('הפקדון נשבר'); fetchDeposits(); } catch { toast.error('שגיאה'); }
  };

  const handleMature = async (id) => {
    try { await matureDeposit(id); toast.success('הפקדון נפדה'); fetchDeposits(); } catch { toast.error('שגיאה'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את הפקדון?')) return;
    try { await deleteDeposit(id); toast.success('נמחק'); } catch { toast.error('שגיאה'); }
  };

  const summary = depositsSummary || {};
  const activeDeposits = deposits.filter(d => d.status === 'active');
  const otherDeposits = deposits.filter(d => d.status !== 'active');

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex-1">חסכונות ופקדונות</h1>
            <button onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm hover:bg-blue-700">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {/* Summary */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200/50">
          <p className="text-sm text-emerald-100 mb-1">סה"כ פקדונות פעילים</p>
          <p className="text-4xl font-bold tracking-tight mb-2">
            ₪{(summary.totalPrincipal || 0).toLocaleString()}
          </p>
          <div className="flex gap-4 text-sm text-emerald-100">
            <span>{summary.activeCount || 0} פעילים</span>
            <span>ערך עתידי: ₪{(summary.totalFutureValue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Upcoming exits */}
        {summary.upcomingExits?.length > 0 && (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertCircle size={12} /> נקודות יציאה קרובות
            </h3>
            {summary.upcomingExits.map((exit, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span>{exit.name}</span>
                <span className="text-amber-700 font-medium">בעוד {exit.daysUntil} ימים</span>
              </div>
            ))}
          </div>
        )}

        {depositsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-12">
            <PiggyBank size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-500">אין פקדונות</p>
            <p className="text-sm text-gray-400 mt-1">הוסיפו פקדון לניהול החסכונות</p>
          </div>
        ) : (
          <>
            {/* Active deposits */}
            {activeDeposits.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">פעילים</h3>
                <div className="space-y-3">
                  {activeDeposits.map(d => (
                    <DepositCard key={d._id} deposit={d}
                      onBreak={() => handleBreak(d._id)}
                      onMature={() => handleMature(d._id)}
                      onDelete={() => handleDelete(d._id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other deposits */}
            {otherDeposits.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">היסטוריה</h3>
                <div className="space-y-2">
                  {otherDeposits.map(d => (
                    <DepositCard key={d._id} deposit={d} onDelete={() => handleDelete(d._id)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Form */}
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
                  <h2 className="text-lg font-bold">פקדון חדש</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="שם הפקדון" className="w-full p-3.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300">₪</span>
                      <input type="number" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
                        placeholder="קרן" className="w-full p-3 pr-9 rounded-xl bg-gray-50 text-lg font-bold outline-none text-left" />
                    </div>
                    <div className="relative">
                      <input type="number" value={form.annualInterestRate} onChange={e => setForm(f => ({ ...f, annualInterestRate: e.target.value }))}
                        placeholder="ריבית שנתית" step="0.01" className="w-full p-3 rounded-xl bg-gray-50 text-base outline-none text-left" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">תאריך פתיחה</label>
                      <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">תאריך סיום</label>
                      <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none" />
                    </div>
                  </div>

                  <input type="text" value={form.sourceAccount} onChange={e => setForm(f => ({ ...f, sourceAccount: e.target.value }))}
                    placeholder="חשבון מקור (לא חובה)" className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none" />

                  <button type="submit" disabled={submitting}
                    className="w-full p-4 rounded-xl bg-emerald-600 text-white font-bold text-lg disabled:opacity-50 hover:bg-emerald-700 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    הוסף פקדון
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

function DepositCard({ deposit: d, onBreak, onMature, onDelete }) {
  const daysLeft = d.daysLeft ?? Math.ceil((new Date(d.endDate) - new Date()) / (1000 * 60 * 60 * 24));
  const futureValue = d.futureValue || d.principal;
  const profit = futureValue - d.principal;
  const progress = d.startDate && d.endDate
    ? Math.min(100, Math.max(0, Math.round(((Date.now() - new Date(d.startDate)) / (new Date(d.endDate) - new Date(d.startDate))) * 100)))
    : 0;

  return (
    <motion.div layout className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-sm">{d.name}</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[d.status] || d.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <p className="text-xs text-gray-400">קרן</p>
          <p className="text-sm font-bold">₪{d.principal?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">ריבית</p>
          <p className="text-sm font-bold">{d.annualInterestRate}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">רווח</p>
          <p className="text-sm font-bold text-green-600">₪{Math.round(profit).toLocaleString()}</p>
        </div>
      </div>

      {d.status === 'active' && (
        <>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }} className="h-full rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>{new Date(d.startDate).toLocaleDateString('he-IL')}</span>
            <span>{daysLeft > 0 ? `${daysLeft} ימים` : 'הגיע מועד'}</span>
            <span>{new Date(d.endDate).toLocaleDateString('he-IL')}</span>
          </div>
          <div className="flex gap-2">
            {onMature && (
              <button onClick={onMature}
                className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100">
                פדה
              </button>
            )}
            {onBreak && (
              <button onClick={onBreak}
                className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100">
                שבור
              </button>
            )}
          </div>
        </>
      )}

      {onDelete && d.status !== 'active' && (
        <button onClick={onDelete}
          className="w-full mt-2 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
          מחק
        </button>
      )}
    </motion.div>
  );
}
