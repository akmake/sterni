import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Loader2, Tag, X, Check,
  RefreshCw, Zap, Search
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: 'expense', label: 'הוצאה' },
  { value: 'income', label: 'הכנסה' },
  { value: 'general', label: 'כללי' },
];
const MATCH_TYPES = [
  { value: 'contains', label: 'מכיל' },
  { value: 'exact', label: 'מדויק' },
  { value: 'starts_with', label: 'מתחיל ב' },
];

export default function FinanceCategoriesPage() {
  useSocket();
  const {
    categories, rules, categoriesLoading,
    fetchCategories, createCategory, deleteCategory, syncCategories,
    fetchRules, createRule, deleteRule, applyRules,
    setupSocketListeners, cleanupSocketListeners,
  } = useFinanceStore();

  const [tab, setTab] = useState('categories'); // categories | rules
  const [showCatForm, setShowCatForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', color: '#3B82F6' });
  const [ruleForm, setRuleForm] = useState({ searchString: '', matchType: 'contains', newName: '', category: '' });

  useEffect(() => {
    fetchCategories();
    fetchRules();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name) return;
    setSubmitting(true);
    try {
      await createCategory(catForm);
      setShowCatForm(false);
      setCatForm({ name: '', type: 'expense', color: '#3B82F6' });
      toast.success('קטגוריה נוספה');
    } catch (err) { toast.error(err.error || 'שגיאה'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('למחוק קטגוריה?')) return;
    try { await deleteCategory(id); toast.success('נמחק'); } catch { toast.error('שגיאה'); }
  };

  const handleSync = async () => {
    try { await syncCategories(); toast.success('קטגוריות ברירת מחדל סונכרנו'); } catch { toast.error('שגיאה'); }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.searchString || !ruleForm.category) return;
    setSubmitting(true);
    try {
      await createRule(ruleForm);
      setShowRuleForm(false);
      setRuleForm({ searchString: '', matchType: 'contains', newName: '', category: '' });
      toast.success('חוק נוסף');
    } catch (err) { toast.error(err.error || 'שגיאה'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('למחוק חוק?')) return;
    try { await deleteRule(id); toast.success('נמחק'); } catch { toast.error('שגיאה'); }
  };

  const handleApplyRules = async () => {
    try {
      const res = await applyRules();
      toast.success(`${res.modified || 0} עסקאות עודכנו`);
    } catch { toast.error('שגיאה'); }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex-1">קטגוריות וחוקים</h1>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-2 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab('categories')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'categories' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
              }`}>
              קטגוריות ({categories.length})
            </button>
            <button onClick={() => setTab('rules')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'rules' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
              }`}>
              חוקים ({rules.length})
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {/* Categories Tab */}
        {tab === 'categories' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setShowCatForm(true)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-blue-700">
                <Plus size={16} /> הוסף קטגוריה
              </button>
              <button onClick={handleSync}
                className="py-2.5 px-4 rounded-xl bg-white text-blue-600 text-sm font-medium border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5">
                <RefreshCw size={14} /> סנכרן
              </button>
            </div>

            {categoriesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12">
                <Tag size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-lg font-medium text-gray-500">אין קטגוריות</p>
                <p className="text-sm text-gray-400 mt-1">לחצו על "סנכרן" להוספת ברירות מחדל</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map(cat => (
                  <motion.div key={cat._id} layout
                    className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || '#3B82F6' }} />
                      <div>
                        <p className="text-sm font-bold">{cat.name}</p>
                        <p className="text-xs text-gray-400">{cat.type}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteCategory(cat._id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Rules Tab */}
        {tab === 'rules' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setShowRuleForm(true)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-blue-700">
                <Plus size={16} /> הוסף חוק
              </button>
              <button onClick={handleApplyRules}
                className="py-2.5 px-4 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5">
                <Zap size={14} /> החל חוקים
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="text-center py-12">
                <Search size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-lg font-medium text-gray-500">אין חוקים</p>
                <p className="text-sm text-gray-400 mt-1">חוקים מקטלגים עסקאות אוטומטית</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <motion.div key={rule._id} layout
                    className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
                          {MATCH_TYPES.find(m => m.value === rule.matchType)?.label || rule.matchType}
                        </span>
                        <p className="text-sm font-bold truncate">"{rule.searchString}"</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {rule.newName && `← ${rule.newName} · `}
                        {rule.category?.name || 'ללא קטגוריה'}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteRule(rule._id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors mr-2">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add Category Form */}
      <AnimatePresence>
        {showCatForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setShowCatForm(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl"
            >
              <form onSubmit={handleAddCategory} className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">קטגוריה חדשה</h2>
                  <button type="button" onClick={() => setShowCatForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input type="text" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="שם הקטגוריה" className="w-full p-3.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
                  <div className="flex gap-2">
                    {TYPE_OPTIONS.map(t => (
                      <button key={t.value} type="button" onClick={() => setCatForm(f => ({ ...f, type: t.value }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          catForm.type === t.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">צבע</label>
                    <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full p-4 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    הוסף
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Rule Form */}
      <AnimatePresence>
        {showRuleForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setShowRuleForm(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl"
            >
              <form onSubmit={handleAddRule} className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">חוק חדש</h2>
                  <button type="button" onClick={() => setShowRuleForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input type="text" value={ruleForm.searchString} onChange={e => setRuleForm(f => ({ ...f, searchString: e.target.value }))}
                    placeholder="מחרוזת לחיפוש" className="w-full p-3.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
                  <div className="flex gap-2">
                    {MATCH_TYPES.map(m => (
                      <button key={m.value} type="button" onClick={() => setRuleForm(f => ({ ...f, matchType: m.value }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          ruleForm.matchType === m.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={ruleForm.newName} onChange={e => setRuleForm(f => ({ ...f, newName: e.target.value }))}
                    placeholder="שם תצוגה חדש (לא חובה)" className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none" />
                  <select value={ruleForm.category} onChange={e => setRuleForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-gray-50 text-sm outline-none">
                    <option value="">בחר קטגוריה</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={submitting}
                    className="w-full p-4 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    הוסף חוק
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
