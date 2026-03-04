import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { format, isSameMonth, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Upload, Search, ChevronDown, Loader2, Landmark, Zap } from 'lucide-react';

import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { TransactionCard } from '@/components/transactions/TransactionCard';
import KpiBar from '@/components/transactions/KpiBar';
import MerchantDialog from '@/components/transactions/MerchantDialog';
import ImportWizard from '@/components/transactions/ImportWizard';
import AddTransactionForm from '@/components/transactions/AddTransactionForm';

export default function FinanceTransactionsPage() {
  const navigate = useNavigate();

  // ─── Data ───────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  // Tracks the start of the oldest month currently loaded
  const [oldestMonth,  setOldestMonth]  = useState(null);

  // ─── Filters ────────────────────────────────────────────────
  const [filterType,  setFilterType]  = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Scroll sentinel ─────────────────────────────────────────
  const sentinelRef = useRef(null);

  // ─── Merchant dialog ─────────────────────────────────────────
  const [selectedMerchant,     setSelectedMerchant]     = useState(null);
  const [isMerchantDialogOpen, setIsMerchantDialogOpen] = useState(false);

  // ─── Import wizard ────────────────────────────────────────────
  const [importState,     setImportState]     = useState('idle');
  const [importerType,    setImporterType]    = useState('');
  const [parsedTxns,      setParsedTxns]      = useState([]);
  const [unseenMerchants, setUnseenMerchants] = useState([]);
  const [mappings,        setMappings]        = useState({});
  const [importMessage,   setImportMessage]   = useState('');
  const fileInputRef = useRef(null);
  const bankFileInputRef = useRef(null);

  // ─── Helpers ─────────────────────────────────────────────────
  const fetchMonth = useCallback(async (monthDate) => {
    const from = startOfMonth(monthDate).toISOString();
    const to   = endOfMonth(monthDate).toISOString();
    const res  = await api.get(`/finance/transactions?from=${from}&to=${to}`);
    return res.data || [];
  }, []);

  // ─── Initial load ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [latestRes, catRes] = await Promise.all([
          api.get('/finance/transactions?limit=1'),
          api.get('/finance/categories'),
        ]);
        setCategories(catRes.data || []);
        const latest = latestRes.data?.[0];
        if (!latest) { setHasMore(false); return; }

        const effectiveMonth = startOfMonth(new Date(latest.date));
        const data = await fetchMonth(effectiveMonth);
        setTransactions(data);
        setOldestMonth(effectiveMonth);
        setHasMore(true);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [fetchMonth]);

  // ─── Load more — month by month ───────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !oldestMonth) return;
    setLoadingMore(true);
    try {
      // 1. Is there anything older than the current oldest month?
      const checkRes = await api.get(
        `/finance/transactions?before=${startOfMonth(oldestMonth).toISOString()}&limit=1`
      );
      if (!checkRes.data?.length) { setHasMore(false); return; }

      // 2. Load the full month that contains that older transaction
      const targetMonth = startOfMonth(new Date(checkRes.data[0].date));
      const data = await fetchMonth(targetMonth);
      if (data.length > 0) {
        setTransactions(prev => [...prev, ...data]);
        setOldestMonth(targetMonth);
      } else {
        setHasMore(false);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, oldestMonth, fetchMonth]);

  // ─── Refresh (after add/delete) ──────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const latestRes = await api.get('/finance/transactions?limit=1');
      const latest = latestRes.data?.[0];
      if (!latest) { setTransactions([]); setHasMore(false); return; }
      const effectiveMonth = startOfMonth(new Date(latest.date));
      const data = await fetchMonth(effectiveMonth);
      setTransactions(data);
      setOldestMonth(effectiveMonth);
      setHasMore(true);
    } catch (err) { console.error(err); }
  }, [fetchMonth]);

  // ─── Intersection Observer ───────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ─── Derived state ───────────────────────────────────────────
  // Effective month = most recent loaded transaction's month
  const effectiveMonth = useMemo(() =>
    transactions.length ? new Date(transactions[0].date) : new Date(),
    [transactions]
  );

  // Filtered + grouped by month
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (filterType === 'expense') result = result.filter(t => t.type === 'הוצאה');
    if (filterType === 'income')  result = result.filter(t => t.type === 'הכנסה');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [transactions, filterType, searchQuery]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(t => {
      const key = format(new Date(t.date), 'LLLL yyyy', { locale: he });
      if (!groups[key]) groups[key] = { date: new Date(t.date), txns: [] };
      groups[key].txns.push(t);
    });
    return Object.entries(groups).sort((a, b) => b[1].date - a[1].date);
  }, [filteredTransactions]);

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/finance/transactions/${id}`);
      setTransactions(prev => prev.filter(t => t._id !== id));
    } catch { alert('שגיאה במחיקת העסקה'); }
  };

  // ─── Import ──────────────────────────────────────────────────
  const resetImport = () => {
    setImportState('idle'); setImporterType(''); setParsedTxns([]);
    setUnseenMerchants([]); setMappings({}); setImportMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (bankFileInputRef.current) bankFileInputRef.current.value = '';
  };

  const handleImportClick = (type) => {
    resetImport(); setImporterType(type); fileInputRef.current?.click();
  };

  const analyzeFile = (file, type) => {
    setImportState('processing'); setImportMessage('מנתח קובץ...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        let allRaw = [];
        wb.SheetNames.forEach(s => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null });
          if (rows.length) allRaw = allRaw.concat(rows);
        });
        const { data: res } = await api.post('/finance/import/parse', { data: allRaw, fileType: type });
        setParsedTxns(res.transactions);
        if (res.unseenMerchants?.length > 0) {
          setUnseenMerchants(res.unseenMerchants);
          const init = {};
          res.unseenMerchants.forEach(n => { init[n] = { newName: n, category: '' }; });
          setMappings(init);
          setImportState('mapping');
        } else {
          setImportState('confirming');
        }
      } catch (err) {
        setImportMessage(err.response?.data?.message || 'שגיאה בקובץ');
        setImportState('error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (originalName, field, value) =>
    setMappings(prev => ({ ...prev, [originalName]: { ...prev[originalName], [field]: value } }));

  const handleConfirmImport = async () => {
    setImportState('processing'); setImportMessage('שומר נתונים...');
    const newMappings = Object.entries(mappings)
      .map(([orig, vals]) => ({ originalName: orig, newName: vals.newName.trim() || orig, category: vals.category || null }))
      .filter(m => m.newName !== m.originalName || m.category);

    const finalTxns = parsedTxns.map(trx => {
      const m = mappings[trx.description];
      if (m) {
        const newCat = categories.find(c => c._id === m.category)?.name;
        return { ...trx, description: m.newName.trim() || trx.description, ...(newCat && { category: newCat }) };
      }
      return trx;
    });

    try {
      await api.post('/finance/import/process', { transactions: finalTxns, newMappings });
      setImportMessage('הייבוא הושלם בהצלחה');
      setImportState('finished');
      refresh();
    } catch {
      setImportMessage('שגיאה בשמירה');
      setImportState('error');
    }
  };

  // ─── Bank income import (Discount) ────────────────────────────
  const handleBankImportClick = (bankType) => {
    resetImport(); setImporterType(bankType); bankFileInputRef.current?.click();
  };

  const analyzeDiscountFile = (file) => {
    setImportState('processing'); setImportMessage('מנתח קובץ בנק...');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Find header row
        let headerIdx = -1;
        for (let i = 0; i < data.length; i++) {
          const rowStr = (data[i] || []).map(c => String(c || '')).join(' ');
          if (rowStr.includes('תאריך') && rowStr.includes('תיאור התנועה')) { headerIdx = i; break; }
        }
        if (headerIdx === -1) { setImportMessage('לא זוהה פורמט תקין של קובץ עו"ש'); setImportState('error'); return; }

        const headers = data[headerIdx];
        const dateIdx   = headers.findIndex(h => String(h || '').includes('תאריך'));
        const descIdx   = headers.findIndex(h => String(h || '').includes('תיאור התנועה'));
        const amountIdx = headers.findIndex(h => String(h || '').includes('זכות/חובה'));

        const parsed = [];
        for (let i = headerIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row[dateIdx] == null) continue;
          let rawAmount = row[amountIdx];
          if (typeof rawAmount === 'string') rawAmount = rawAmount.replace(/,/g, '');
          const amount = parseFloat(rawAmount);
          if (isNaN(amount)) continue;
          const desc = String(row[descIdx] || '').trim();
          if (amount <= 0 || desc.includes('פיקדון')) continue;

          // Parse date
          let rawDate = row[dateIdx], formattedDate = '';
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const epoch = new Date(Date.UTC(1899, 11, 30));
            formattedDate = new Date(epoch.getTime() + rawDate * 86400000).toISOString().split('T')[0];
          } else {
            const s = String(rawDate).trim();
            if (s.includes('/')) {
              const p = s.split('/');
              if (p.length === 3) { const y = p[2].length === 2 ? `20${p[2]}` : p[2]; formattedDate = `${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; }
              else formattedDate = s;
            } else if (s.includes('-')) {
              const p = s.split('-');
              formattedDate = p[0].length === 4 ? s : (p[2]?.length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : s);
            } else formattedDate = s;
          }

          parsed.push({ date: formattedDate, description: desc, amount, type: 'הכנסה', category: 'כללי', account: 'checking' });
        }

        if (parsed.length === 0) {
          setImportMessage('לא נמצאו הכנסות בקובץ (או שכולן קשורות לפיקדון)');
          setImportState('error');
        } else {
          setParsedTxns(parsed);
          setImportMessage(`נמצאו ${parsed.length} הכנסות`);
          setImportState('confirming');
        }
      } catch (err) {
        console.error(err);
        setImportMessage('שגיאה בפענוח הקובץ');
        setImportState('error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // For bank imports, save directly as individual transactions
  const handleConfirmBankImport = async () => {
    setImportState('processing'); setImportMessage('שומר הכנסות...');
    let ok = 0, err = 0;
    for (const tx of parsedTxns) {
      try { await api.post('/finance/transactions', tx); ok++; } catch (e) {
        if (e.response?.status !== 409) err++;
      }
    }
    setImportMessage(`${ok} הכנסות נשמרו בהצלחה${err ? ` (${err} שגיאות)` : ''}`);
    setImportState('finished');
    refresh();
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">הארנק שלי</h1>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {/* Credit card import */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full h-9 sm:h-10 px-3 sm:px-5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all text-sm font-semibold">
                <Upload className="ml-1.5 h-4 w-4" /> ייבוא אשראי <ChevronDown className="mr-1.5 h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl min-w-[150px]" align="end">
              <DropdownMenuItem onClick={() => handleImportClick('max')}      className="cursor-pointer font-medium py-3">Max</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportClick('cal')}      className="cursor-pointer font-medium py-3">Cal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportClick('isracard')} className="cursor-pointer font-medium py-3">ישראכרט</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bank income import */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full h-9 sm:h-10 px-3 sm:px-5 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:shadow-md transition-all text-sm font-semibold">
                <Landmark className="ml-1.5 h-4 w-4" /> ייבוא הכנסות <ChevronDown className="mr-1.5 h-4 w-4 text-emerald-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl min-w-[150px]" align="end">
              <DropdownMenuItem onClick={() => handleBankImportClick('discount')} className="cursor-pointer font-medium py-3">דיסקונט</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Automation button */}
          <Button
            variant="outline"
            onClick={() => navigate('/household/finance/automation')}
            className="rounded-full h-9 sm:h-10 px-3 sm:px-5 bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:shadow-md transition-all text-sm font-semibold"
          >
            <Zap className="ml-1.5 h-4 w-4" /> אוטומציה
          </Button>

          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f, importerType); }} />
          <input type="file" ref={bankFileInputRef} accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f && importerType === 'discount') analyzeDiscountFile(f); }} />
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* KPI bar */}
        <KpiBar transactions={transactions} effectiveMonth={effectiveMonth} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">

          {/* Main feed */}
          <main className="lg:col-span-8">

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 shrink-0">פעילות</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="חיפוש לפי תיאור או קטגוריה..."
                    className="h-10 pl-4 pr-9 rounded-full bg-white/60 backdrop-blur-sm border-white/50 shadow-sm text-sm w-full"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 sm:gap-2 bg-white/60 p-1 rounded-full border border-white/50 shadow-sm w-fit">
                  {[['all', 'הכל'], ['expense', 'הוצאות'], ['income', 'הכנסות']].map(([val, label]) => (
                    <Badge
                      key={val}
                      onClick={() => setFilterType(val)}
                      className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium text-xs sm:text-sm transition-colors ${
                        filterType === val ? 'bg-white hover:bg-slate-50 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'
                      }`}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : groupedByMonth.length === 0 ? (
              <div className="text-center py-16 bg-white/40 rounded-3xl border border-white/50">
                <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">לא נמצאו עסקאות</h3>
                <p className="text-sm text-slate-500">נסה לשנות את הסינון</p>
              </div>
            ) : (
              <>
                {groupedByMonth.map(([monthLabel, { date, txns }]) => (
                  <div key={monthLabel} className="mb-10">
                    <div className="sticky top-20 z-20 backdrop-blur-md bg-[#F2F4F8]/80 py-2 mb-4 px-2 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {monthLabel}
                        {isSameMonth(date, new Date()) && (
                          <span className="mr-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full normal-case">החודש</span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400">{txns.length} עסקאות</span>
                    </div>
                    <div className="space-y-2">
                      {txns.map(t => (
                        <TransactionCard
                          key={t._id}
                          transaction={t}
                          onClick={() => { setSelectedMerchant(t.description); setIsMerchantDialogOpen(true); }}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Scroll sentinel */}
                <div ref={sentinelRef} className="py-6 text-center">
                  {loadingMore ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-300 mx-auto" />
                  ) : hasMore ? (
                    <p className="text-xs text-slate-300">גולל למטה לטעינת עוד...</p>
                  ) : (
                    <p className="text-xs text-slate-300">הגעת לתחילת ההיסטוריה</p>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <AddTransactionForm
              categories={categories}
              onAdd={refresh}
              onCategoryCreated={cat =>
                setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
              }
            />
          </aside>
        </div>
      </div>

      {/* Merchant dialog */}
      <MerchantDialog
        isOpen={isMerchantDialogOpen}
        onOpenChange={setIsMerchantDialogOpen}
        merchantName={selectedMerchant}
        categories={categories}
        onRefresh={refresh}
      />

      {/* Import wizard */}
      <ImportWizard
        importState={importState}
        importMessage={importMessage}
        unseenMerchants={unseenMerchants}
        mappings={mappings}
        parsedTransactions={parsedTxns}
        categories={categories}
        onMappingChange={handleMappingChange}
        onConfirm={importerType === 'discount' ? handleConfirmBankImport : handleConfirmImport}
        onReset={resetImport}
      />
    </div>
  );
}
