import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Trash2, Play, RefreshCw, Plus, Database,
  Bot, Zap, Search, ArrowRight, Tag, Sparkles,
  ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function FinanceAutomationPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  const [newCatData, setNewCatData] = useState({ name: '', type: 'expense' });

  const [formData, setFormData] = useState({
    searchString: '', newName: '', categoryId: '', matchType: 'contains'
  });

  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, catsRes, transRes] = await Promise.all([
        api.get('/finance/categories/rules'),
        api.get('/finance/categories'),
        api.get('/finance/transactions?limit=2000'),
      ]);
      setRules(rulesRes.data);
      setCategories(catsRes.data);
      setTransactions(transRes.data);
    } catch (error) {
      console.error(error);
      toast({ title: 'שגיאה בטעינת נתונים', variant: 'destructive' });
    }
  };

  const uniqueMerchants = useMemo(() => {
    const merchants = new Set();
    transactions.forEach(t => {
      if (t.description) merchants.add(t.description);
      if (t.rawDescription) merchants.add(t.rawDescription);
    });
    return Array.from(merchants).sort();
  }, [transactions]);

  const handleSyncCategories = async () => {
    setSyncLoading(true);
    try {
      const res = await api.post('/finance/categories/sync');
      toast({ title: 'סנכרון הצליח', description: res.data.message });
      fetchData();
    } catch {
      toast({ title: 'שגיאה', description: 'לא ניתן לסנכרן קטגוריות', variant: 'destructive' });
    } finally { setSyncLoading(false); }
  };

  const handleCreateCategory = async () => {
    if (!newCatData.name) return;
    try {
      const res = await api.post('/finance/categories', newCatData);
      setCategories([...categories, res.data]);
      setIsCatDialogOpen(false);
      setNewCatData({ name: '', type: 'expense' });
      setFormData(prev => ({ ...prev, categoryId: res.data._id }));
      toast({ title: 'קטגוריה נוצרה בהצלחה' });
    } catch (error) {
      toast({ title: 'שגיאה', description: error.response?.data?.message || 'יצירת קטגוריה נכשלה', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.searchString || !formData.categoryId) {
      toast({ title: 'חסרים פרטים', description: 'יש להזין טקסט לחיפוש וקטגוריה', variant: 'destructive' });
      return;
    }
    try {
      const res = await api.post('/finance/categories/rules', formData);
      setRules([res.data, ...rules]);
      setFormData({ searchString: '', newName: '', categoryId: '', matchType: 'contains' });
      toast({ title: 'האוטומציה נשמרה בהצלחה!', description: 'היא תופעל אוטומטית בייבוא הבא.' });
    } catch {
      toast({ title: 'שגיאה', description: 'לא ניתן לשמור את החוק (אולי הוא כבר קיים?)', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/finance/categories/rules/${id}`);
      setRules(rules.filter(r => r._id !== id));
      toast({ title: 'האוטומציה נמחקה' });
    } catch { toast({ title: 'שגיאה במחיקה', variant: 'destructive' }); }
  };

  const handleApplyRules = async () => {
    if (!window.confirm('פעולה זו תעבור על כל ההיסטוריה שלך ותעדכן שמות וקטגוריות לפי החוקים. להמשיך?')) return;
    setLoading(true);
    try {
      const res = await api.post('/finance/categories/rules/apply');
      toast({ title: 'תהליך הסנכרון הושלם', description: res.data.message });
    } catch {
      toast({ title: 'שגיאה', description: 'הסנכרון נכשל', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(r =>
      r.searchString.toLowerCase().includes(q) ||
      (r.newName && r.newName.toLowerCase().includes(q)) ||
      (r.category?.name && r.category.name.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 font-sans text-slate-900 pb-20" dir="rtl">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-8 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/household/finance/transactions')}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
                <Zap className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                אוטומציה של עסקאות
              </h1>
            </div>
          </div>

          <Button
            onClick={handleApplyRules}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-sm transition-all text-sm"
          >
            {loading ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
            {loading ? 'מעבד...' : 'החל על הכל'}
          </Button>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── New Rule Creator ── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h2 className="text-lg font-bold text-slate-800">צור אוטומציה חדשה</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Step 1 */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold">1</span>
                    <span className="text-sm font-semibold text-slate-600">זיהוי עסק</span>
                  </div>
                  <Input
                    list="merchants-list"
                    className="bg-white border-slate-200 focus-visible:ring-violet-500 h-11"
                    placeholder="בחר או הקלד שם עסק..."
                    value={formData.searchString}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, searchString: val, newName: prev.newName || val }));
                    }}
                  />
                  <datalist id="merchants-list">
                    {uniqueMerchants.map((m, i) => <option key={i} value={m} />)}
                  </datalist>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold">2</span>
                    <span className="text-sm font-semibold text-slate-600">שם חדש</span>
                  </div>
                  <Input
                    className="bg-white border-slate-200 focus-visible:ring-violet-500 h-11"
                    placeholder="לדוגמה: תחנת דלק פז"
                    value={formData.newName}
                    onChange={e => setFormData({ ...formData, newName: e.target.value })}
                  />
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold">3</span>
                    <span className="text-sm font-semibold text-slate-600">קטגוריה</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      value={formData.categoryId}
                      onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      <option value="">בחר קטגוריה...</option>
                      {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                    </select>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => setIsCatDialogOpen(true)}
                      className="shrink-0 h-11 w-11 border-slate-200 text-violet-600 hover:bg-violet-50"
                      title="צור קטגוריה חדשה"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-11 rounded-xl shadow-sm transition-all">
                  <Zap className="w-4 h-4 ml-2" />
                  שמור אוטומציה
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Active Rules ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-500" />
              אוטומציות פעילות
              <Badge variant="secondary" className="bg-violet-100 text-violet-700 rounded-full px-3 text-xs">
                {filteredRules.length}
              </Badge>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="חפש אוטומציה..."
                className="pr-9 bg-white border-slate-200 rounded-xl shadow-sm focus-visible:ring-violet-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredRules.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-base font-medium text-slate-700 mb-1">אין אוטומציות פעילות</h4>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  {searchQuery ? 'לא נמצאו תוצאות.' : 'צור את האוטומציה הראשונה שלך למעלה.'}
                </p>
              </div>
            ) : (
              filteredRules.map(rule => (
                <div key={rule._id} className="group flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-violet-50 p-2.5 rounded-lg text-violet-500">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>מזהה:</span>
                        <code className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {rule.searchString}
                        </code>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 font-medium text-slate-800 text-sm">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />
                        <span>{rule.newName || rule.searchString}</span>
                        <Badge
                          variant="outline"
                          style={{ borderColor: rule.category?.color, color: rule.category?.color, backgroundColor: `${rule.category?.color}10` }}
                          className="text-xs"
                        >
                          {rule.category?.name || 'ללא קטגוריה'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleDelete(rule._id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Collapsible Categories ── */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Tag className="w-5 h-5 text-violet-500" />
              <span className="text-base font-bold text-slate-800">קטגוריות</span>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 rounded-full px-2.5 text-xs">
                {categories.length}
              </Badge>
            </div>
            {showCategories ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showCategories && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => setIsCatDialogOpen(true)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs">
                  <Plus className="w-3.5 h-3.5 ml-1.5" />
                  קטגוריה חדשה
                </Button>
                <Button onClick={handleSyncCategories} disabled={syncLoading} variant="outline" size="sm" className="rounded-lg text-xs border-slate-200">
                  <Database className={`w-3.5 h-3.5 ml-1.5 ${syncLoading ? 'animate-bounce' : ''}`} />
                  {syncLoading ? 'מסנכרן...' : 'סנכרון ברירת מחדל'}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {categories.map(cat => (
                  <div key={cat._id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#cbd5e1' }} />
                    <span className="text-sm font-medium text-slate-600 truncate" title={cat.name}>{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Create category dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-500" />
              יצירת קטגוריה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cat-name" className="text-right font-medium text-sm">שם</Label>
              <Input
                id="cat-name" placeholder="לדוגמה: ביטוחים"
                value={newCatData.name}
                onChange={e => setNewCatData({ ...newCatData, name: e.target.value })}
                className="col-span-3 h-10"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cat-type" className="text-right font-medium text-sm">סוג</Label>
              <select
                id="cat-type" value={newCatData.type}
                onChange={e => setNewCatData({ ...newCatData, type: e.target.value })}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCategory} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6">
              שמור קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
