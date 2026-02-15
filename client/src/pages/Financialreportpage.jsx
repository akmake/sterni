import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePaymentStore from '@/stores/Paymentstore';
import {
  TrendingUp, TrendingDown, DollarSign, CheckCircle2, Clock,
  AlertTriangle, Search, Filter, ChevronDown, ArrowUpDown,
  RotateCcw, Users, Calendar, ExternalLink, BarChart3,
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 }).format(amount);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const STATUS_STYLES = {
  paid_full: { label: 'שולם', color: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  partial: { label: 'חלקי', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  pending: { label: 'ממתין', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  unpaid: { label: 'לא שולם', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  no_billing: { label: 'לא הוגדר', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export default function FinancialReportPage() {
  const { allGroupsReport, reportLoading, fetchAllGroupsReport } = usePaymentStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('startDate');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchAllGroupsReport();
  }, []);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const filteredGroups = useMemo(() => {
    let list = allGroupsReport?.groups || [];
    if (statusFilter !== 'all') list = list.filter(g => g.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q) || g.contactPerson?.name?.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === 'startDate' || sortBy === 'dueDate') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [allGroupsReport, search, statusFilter, sortBy, sortDir]);

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RotateCcw size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const totals = allGroupsReport?.totals || {};

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={24} className="text-blue-600" />
          דוח כספי כולל
        </h1>
        <p className="text-sm text-gray-500 mt-1">סקירת מצב תשלומים לכל הקבוצות</p>
      </div>

      {/* Totals Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={14} /> סה"כ לגבייה</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totals.totalExpected || 0)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> נגבה (מאושר)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totals.confirmedTotal || 0)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-amber-600 flex items-center gap-1"><Clock size={14} /> ממתין לאישור</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(totals.pendingTotal || 0)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-red-500 flex items-center gap-1"><TrendingDown size={14} /> יתרה לגבייה</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totals.remaining || 0)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש קבוצה..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
          {[
            { key: 'all', label: 'הכל' },
            { key: 'unpaid', label: 'לא שולם' },
            { key: 'partial', label: 'חלקי' },
            { key: 'pending', label: 'ממתין' },
            { key: 'paid_full', label: 'שולם' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === f.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                {[
                  { key: 'name', label: 'קבוצה' },
                  { key: 'startDate', label: 'תאריך' },
                  { key: 'totalExpected', label: 'סה"כ לחיוב' },
                  { key: 'confirmedTotal', label: 'שולם' },
                  { key: 'remaining', label: 'יתרה' },
                  { key: 'paidPercentage', label: 'התקדמות' },
                  { key: 'status', label: 'סטטוס' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown size={12} className={sortBy === col.key ? 'text-blue-600' : 'text-gray-300'} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => {
                const st = STATUS_STYLES[g.status] || STATUS_STYLES.no_billing;
                return (
                  <tr key={g._id} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{g.name}</div>
                      {g.contactPerson?.name && (
                        <div className="text-xs text-gray-400">{g.contactPerson.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(g.startDate)}
                      {g.isOverdue && (
                        <span className="mr-1 text-red-500" title="באיחור">
                          <AlertTriangle size={12} className="inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(g.totalExpected)}</td>
                    <td className="px-4 py-3 text-emerald-700 font-medium">{formatCurrency(g.confirmedTotal)}</td>
                    <td className={`px-4 py-3 font-bold ${g.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(g.remaining)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${g.paidPercentage}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-8">{g.paidPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/groups/${g._id}/payments`}
                        className="p-1.5 hover:bg-gray-100 rounded-lg inline-flex transition-colors"
                        title="צפה בתשלומים"
                      >
                        <ExternalLink size={14} className="text-gray-400" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    אין קבוצות התואמות לחיפוש
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}