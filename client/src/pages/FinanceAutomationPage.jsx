import { useState, useMemo, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Trash2, Play, RefreshCw, Plus, Database,
  Bot, Zap, Search, ArrowLeft, Tag, Sparkles
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function FinanceAutomationPage() {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          אוטומציה של עסקאות
        </h1>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <Tabs defaultValue="rules" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="rules" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 px-6">
                <Zap className="w-4 h-4 ml-2" />
                חוקים אוטומטיים
              </TabsTrigger>
              <TabsTrigger value="categories" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 px-6">
                <Tag className="w-4 h-4 ml-2" />
                ניהול קטגוריות
              </TabsTrigger>
            </TabsList>

            <Button onClick={handleApplyRules} disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-md transition-all">
              {loading ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
              {loading ? 'מעבד נתונים...' : 'החל חוקים על כל ההיסטוריה'}
            </Button>
          </div>

          <TabsContent value="rules" className="space-y-8 mt-0 focus-visible:outline-none focus-visible:ring-0">
            {/* Smart Rule Creator */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />

              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">צור אוטומציה חדשה</h3>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 text-lg font-medium">
                  <span>כאשר שם העסק מכיל את המילה</span>
                  <div className="relative w-full md:w-64">
                    <Input
                      list="merchants-list"
                      className="w-full bg-white border-blue-200 focus-visible:ring-blue-500 text-lg h-12 shadow-sm"
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
                  <span className="hidden md:inline">,</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 text-lg font-medium">
                  <span>שנה את השם ל-</span>
                  <Input
                    className="w-full md:w-64 bg-white border-blue-200 focus-visible:ring-blue-500 text-lg h-12 shadow-sm"
                    placeholder="לדוגמה: תחנת דלק פז"
                    value={formData.newName}
                    onChange={e => setFormData({ ...formData, newName: e.target.value })}
                  />
                  <span className="hidden md:inline">,</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 text-lg font-medium">
                  <span>ושייך אוטומטית לקטגוריה</span>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                      className="flex h-12 w-full md:w-64 rounded-md border border-blue-200 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shadow-sm"
                      value={formData.categoryId}
                      onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                    >
                      <option value="">בחר קטגוריה...</option>
                      {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                    </select>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => setIsCatDialogOpen(true)}
                      className="shrink-0 h-12 w-12 border-blue-200 text-blue-600 hover:bg-blue-100 shadow-sm"
                      title="צור קטגוריה חדשה"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <span className="hidden md:inline">.</span>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all">
                    <Zap className="w-5 h-5 ml-2" />
                    הפעל אוטומציה
                  </Button>
                </div>
              </form>
            </div>

            {/* Rules List */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  אוטומציות פעילות
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 rounded-full px-3">
                    {filteredRules.length}
                  </Badge>
                </h3>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="חפש חוק אוטומציה..."
                    className="pr-9 bg-white border-slate-200 rounded-full shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredRules.length === 0 ? (
                  <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bot className="w-10 h-10 text-slate-400" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-800 mb-1">אין אוטומציות פעילות</h4>
                    <p className="text-slate-500 max-w-md mx-auto">
                      {searchQuery ? 'לא נמצאו תוצאות לחיפוש שלך.' : 'צור את האוטומציה הראשונה שלך למעלה ותן למערכת לעבוד בשבילך!'}
                    </p>
                  </div>
                ) : (
                  filteredRules.map(rule => (
                    <div key={rule._id} className="group flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 bg-gradient-to-br from-blue-100 to-indigo-100 p-3 rounded-xl text-blue-600 shadow-inner">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>מזהה:</span>
                            <strong className="text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200">
                              "{rule.searchString}"
                            </strong>
                          </div>
                          <div className="flex items-center flex-wrap gap-2 font-medium text-slate-900">
                            <ArrowLeft className="w-4 h-4 text-slate-400" />
                            <span className="text-base">{rule.newName || rule.searchString}</span>
                            <Badge variant="outline" style={{ borderColor: rule.category?.color, color: rule.category?.color, backgroundColor: `${rule.category?.color}10` }} className="ml-2">
                              {rule.category?.name || 'ללא קטגוריה'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => handleDelete(rule._id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-opacity shrink-0"
                        title="מחק אוטומציה"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Tag className="w-5 h-5 text-blue-500" />
                      קטגוריות במערכת
                    </CardTitle>
                    <CardDescription className="mt-1">
                      נהל את הקטגוריות המשמשות לסיווג העסקאות שלך
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCatDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                      <Plus className="w-4 h-4 ml-2" />
                      קטגוריה חדשה
                    </Button>
                    <Button onClick={handleSyncCategories} disabled={syncLoading} variant="outline" className="rounded-full border-slate-200">
                      <Database className={`w-4 h-4 ml-2 ${syncLoading ? 'animate-bounce' : ''}`} />
                      {syncLoading ? 'מסנכרן...' : 'סנכרון ברירת מחדל'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6">
                  {categories.map(cat => (
                    <div key={cat._id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="w-4 h-4 rounded-full shrink-0 shadow-inner" style={{ backgroundColor: cat.color || '#cbd5e1' }} />
                      <span className="font-medium text-slate-700 truncate" title={cat.name}>{cat.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create category dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-500" />
              יצירת קטגוריה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cat-name" className="text-right font-medium">שם הקטגוריה</Label>
              <Input
                id="cat-name" placeholder="לדוגמה: ביטוחים"
                value={newCatData.name}
                onChange={e => setNewCatData({ ...newCatData, name: e.target.value })}
                className="col-span-3 h-10"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cat-type" className="text-right font-medium">סוג תנועה</Label>
              <select
                id="cat-type" value={newCatData.type}
                onChange={e => setNewCatData({ ...newCatData, type: e.target.value })}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCategory} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
              שמור קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
