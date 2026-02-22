import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import {
  Plus, Trash2, Pencil, X, Save, ChevronDown, ChevronUp,
  Users, Package, CreditCard, BarChart3, History, Loader2,
  Phone, FileText, DollarSign, AlertCircle, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════
//  עמוד ניהול ציציות — מנהלים בלבד
// ═══════════════════════════════════════════════

const TABS = [
  { key: 'dashboard', label: 'דשבורד', icon: BarChart3 },
  { key: 'orders', label: 'הזמנות עבודה', icon: Package },
  { key: 'payments', label: 'תשלומים', icon: CreditCard },
  { key: 'suppliers', label: 'ספקים', icon: Users },
];

const TYPE_LABELS = { tallit: 'טלית', tzitzit: 'ציציות' };
const METHOD_LABELS = {
  cash: 'מזומן',
  transfer: 'העברה בנקאית',
  check: "צ'ק",
  bit: 'ביט',
  other: 'אחר',
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL');
};

const formatCurrency = (n) => {
  return `₪${(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
};

const toInputDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toISOString().split('T')[0];
};

// ═══════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════

export default function TzitzitManagementPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dashboard, setDashboard] = useState({ dashboard: [], totals: {} });
  const [loading, setLoading] = useState(false);

  // ─── History modal state ───
  const [historyModal, setHistoryModal] = useState(null); // { supplier, history, summary }

  // ═══════════════════════════════════════════════
  //  Data fetching
  // ═══════════════════════════════════════════════
  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/tzitzit/suppliers');
      setSuppliers(data);
    } catch (err) {
      toast.error('שגיאה בטעינת ספקים');
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/tzitzit/orders');
      setOrders(data);
    } catch (err) {
      toast.error('שגיאה בטעינת הזמנות');
    }
  };

  const fetchPayments = async () => {
    try {
      const { data } = await api.get('/tzitzit/payments');
      setPayments(data);
    } catch (err) {
      toast.error('שגיאה בטעינת תשלומים');
    }
  };

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/tzitzit/dashboard');
      setDashboard(data);
    } catch (err) {
      toast.error('שגיאה בטעינת דשבורד');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSuppliers(), fetchOrders(), fetchPayments(), fetchDashboard()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openHistory = async (supplierId) => {
    try {
      const { data } = await api.get(`/tzitzit/history/${supplierId}`);
      setHistoryModal(data);
    } catch (err) {
      toast.error('שגיאה בטעינת היסטוריה');
    }
  };

  // ═══════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F5F5F7] p-4 md:p-6 font-sans text-[#1D1D1F]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">ניהול ציציות</h1>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition
                  ${activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'dashboard' && (
          <DashboardTab dashboard={dashboard} onViewHistory={openHistory} />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            suppliers={suppliers}
            onRefresh={() => { fetchOrders(); fetchDashboard(); }}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab
            payments={payments}
            suppliers={suppliers}
            dashboard={dashboard}
            onRefresh={() => { fetchPayments(); fetchDashboard(); }}
          />
        )}
        {activeTab === 'suppliers' && (
          <SuppliersTab
            suppliers={suppliers}
            onRefresh={() => { fetchSuppliers(); fetchDashboard(); }}
          />
        )}

        {/* History Modal */}
        {historyModal && (
          <HistoryModal data={historyModal} onClose={() => setHistoryModal(null)} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  TAB: דשבורד
// ═══════════════════════════════════════════════

function DashboardTab({ dashboard, onViewHistory }) {
  const { dashboard: rows = [], totals = {} } = dashboard;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="סה״כ עבודה"
          value={formatCurrency(totals.totalWorkAmount)}
          icon={Package}
          color="blue"
        />
        <SummaryCard
          label="סה״כ שולם"
          value={formatCurrency(totals.totalPaid)}
          icon={CheckCircle2}
          color="green"
        />
        <SummaryCard
          label="יתרת חוב"
          value={formatCurrency(totals.totalBalance)}
          icon={AlertCircle}
          color={totals.totalBalance > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          label="סה״כ יחידות"
          value={(totals.totalQuantity || 0).toLocaleString('he-IL')}
          icon={BarChart3}
          color="purple"
        />
      </div>

      {/* Supplier Balance Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold">מאזן לפי ספק</h2>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-slate-400 text-center">אין נתונים להצגה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">ספק</th>
                  <th className="px-4 py-3 text-right font-medium">הזמנות</th>
                  <th className="px-4 py-3 text-right font-medium">יחידות</th>
                  <th className="px-4 py-3 text-right font-medium">סה״כ עבודה</th>
                  <th className="px-4 py-3 text-right font-medium">שולם</th>
                  <th className="px-4 py-3 text-right font-medium">יתרת חוב</th>
                  <th className="px-4 py-3 text-center font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.supplier._id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium">{row.supplier.name}</td>
                    <td className="px-4 py-3">{row.totalOrders}</td>
                    <td className="px-4 py-3">{row.totalQuantity.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalWorkAmount)}</td>
                    <td className="px-4 py-3 text-green-600">{formatCurrency(row.totalPaid)}</td>
                    <td className={`px-4 py-3 font-bold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onViewHistory(row.supplier._id)}
                        className="text-blue-600 hover:text-blue-800 transition"
                        title="צפה בהיסטוריה"
                      >
                        <History className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  TAB: הזמנות עבודה
// ═══════════════════════════════════════════════

function OrdersTab({ orders, suppliers, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState('');

  const emptyForm = {
    date: '',
    supplier: '',
    type: 'tzitzit',
    quantity: '',
    pricePerUnit: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const activeSuppliers = suppliers.filter((s) => s.isActive);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterSupplier && o.supplier?._id !== filterSupplier) return false;
      if (filterType && o.type !== filterType) return false;
      return true;
    });
  }, [orders, filterSupplier, filterType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/tzitzit/orders/${editingId}`, {
          ...form,
          quantity: Number(form.quantity),
          pricePerUnit: Number(form.pricePerUnit),
        });
        toast.success('הזמנה עודכנה');
      } else {
        await api.post('/tzitzit/orders', {
          ...form,
          date: form.date || undefined,
          quantity: Number(form.quantity),
          pricePerUnit: Number(form.pricePerUnit),
        });
        toast.success('הזמנה נוספה');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const startEdit = (order) => {
    setForm({
      date: toInputDate(order.date),
      supplier: order.supplier?._id || '',
      type: order.type,
      quantity: order.quantity,
      pricePerUnit: order.pricePerUnit,
      notes: order.notes || '',
    });
    setEditingId(order._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק הזמנה זו?')) return;
    try {
      await api.delete(`/tzitzit/orders/${id}`);
      toast.success('הזמנה נמחקה');
      onRefresh();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          הזמנה חדשה
        </button>

        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm"
        >
          <option value="">כל הספקים</option>
          {activeSuppliers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm"
        >
          <option value="">כל הסוגים</option>
          <option value="tallit">טלית</option>
          <option value="tzitzit">ציציות</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך קבלה</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="ישוּם אוטומטי — היום"
            />
            <p className="text-xs text-slate-400 mt-1">אם ריק — ייקבע לתאריך היום</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ספק *</label>
            <select
              required
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">בחר ספק...</option>
              {activeSuppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סוג *</label>
            <select
              required
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="tzitzit">ציציות</option>
              <option value="tallit">טלית</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כמות *</label>
            <input
              type="number"
              required
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="כמות יחידות"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">מחיר ליחידה (₪) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.pricePerUnit}
              onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="מחיר ליחידה"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">הערות</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="הערות (אופציונלי)"
            />
          </div>

          {/* Computed total */}
          {form.quantity && form.pricePerUnit && (
            <div className="sm:col-span-2 lg:col-span-3 bg-blue-50 rounded-lg p-3 text-blue-800 font-medium">
              סה״כ: {formatCurrency(Number(form.quantity) * Number(form.pricePerUnit))}
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'עדכן' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition"
            >
              <X className="w-4 h-4" />
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <p className="p-6 text-slate-400 text-center">אין הזמנות להצגה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">תאריך</th>
                  <th className="px-4 py-3 text-right font-medium">ספק</th>
                  <th className="px-4 py-3 text-right font-medium">סוג</th>
                  <th className="px-4 py-3 text-right font-medium">כמות</th>
                  <th className="px-4 py-3 text-right font-medium">מחיר/יח׳</th>
                  <th className="px-4 py-3 text-right font-medium">סה״כ</th>
                  <th className="px-4 py-3 text-right font-medium">הערות</th>
                  <th className="px-4 py-3 text-center font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">{formatDate(o.date)}</td>
                    <td className="px-4 py-3 font-medium">{o.supplier?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          o.type === 'tallit'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {TYPE_LABELS[o.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{o.quantity?.toLocaleString('he-IL')}</td>
                    <td className="px-4 py-3">{formatCurrency(o.pricePerUnit)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate">{o.notes || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(o)}
                          className="text-blue-600 hover:text-blue-800 transition"
                          title="ערוך"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(o._id)}
                          className="text-red-500 hover:text-red-700 transition"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  TAB: תשלומים
// ═══════════════════════════════════════════════

function PaymentsTab({ payments, suppliers, dashboard, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterSupplier, setFilterSupplier] = useState('');

  const emptyForm = { date: '', supplier: '', amount: '', method: 'cash', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const activeSuppliers = suppliers.filter((s) => s.isActive);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (filterSupplier && p.supplier?._id !== filterSupplier) return false;
      return true;
    });
  }, [payments, filterSupplier]);

  // אם נבחר ספק בטופס, נראה את החוב שלו
  const selectedSupplierBalance = useMemo(() => {
    if (!form.supplier || !dashboard?.dashboard) return null;
    const row = dashboard.dashboard.find((d) => d.supplier._id === form.supplier);
    return row ? row.balance : null;
  }, [form.supplier, dashboard]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/tzitzit/payments/${editingId}`, {
          ...form,
          amount: Number(form.amount),
        });
        toast.success('תשלום עודכן');
      } else {
        await api.post('/tzitzit/payments', {
          ...form,
          date: form.date || undefined,
          amount: Number(form.amount),
        });
        toast.success('תשלום נרשם');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const startEdit = (payment) => {
    setForm({
      date: toInputDate(payment.date),
      supplier: payment.supplier?._id || '',
      amount: payment.amount,
      method: payment.method,
      notes: payment.notes || '',
    });
    setEditingId(payment._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק תשלום זה?')) return;
    try {
      await api.delete(`/tzitzit/payments/${id}`);
      toast.success('תשלום נמחק');
      onRefresh();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          רישום תשלום
        </button>

        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm"
        >
          <option value="">כל הספקים</option>
          {activeSuppliers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך תשלום</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">אם ריק — ייקבע לתאריך היום</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ספק *</label>
            <select
              required
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">בחר ספק...</option>
              {activeSuppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סכום (₪) *</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="סכום התשלום"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">אמצעי תשלום</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="cash">מזומן</option>
              <option value="transfer">העברה בנקאית</option>
              <option value="check">צ׳ק</option>
              <option value="bit">ביט</option>
              <option value="other">אחר</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">הערות</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="הערות (אופציונלי)"
            />
          </div>

          {/* Show supplier balance when selected */}
          {selectedSupplierBalance !== null && (
            <div className={`sm:col-span-2 lg:col-span-3 rounded-lg p-3 font-medium ${
              selectedSupplierBalance > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              יתרת חוב של ספק זה: {formatCurrency(selectedSupplierBalance)}
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'עדכן' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition"
            >
              <X className="w-4 h-4" />
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredPayments.length === 0 ? (
          <p className="p-6 text-slate-400 text-center">אין תשלומים להצגה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">תאריך</th>
                  <th className="px-4 py-3 text-right font-medium">ספק</th>
                  <th className="px-4 py-3 text-right font-medium">סכום</th>
                  <th className="px-4 py-3 text-right font-medium">אמצעי</th>
                  <th className="px-4 py-3 text-right font-medium">הערות</th>
                  <th className="px-4 py-3 text-center font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 font-medium">{p.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {METHOD_LABELS[p.method] || p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate">{p.notes || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          className="text-blue-600 hover:text-blue-800 transition"
                          title="ערוך"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p._id)}
                          className="text-red-500 hover:text-red-700 transition"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  TAB: ספקים
// ═══════════════════════════════════════════════

function SuppliersTab({ suppliers, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: '', phone: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/tzitzit/suppliers/${editingId}`, form);
        toast.success('ספק עודכן');
      } else {
        await api.post('/tzitzit/suppliers', form);
        toast.success('ספק נוסף');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const startEdit = (supplier) => {
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      notes: supplier.notes || '',
    });
    setEditingId(supplier._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק ספק זה?')) return;
    try {
      await api.delete(`/tzitzit/suppliers/${id}`);
      toast.success('ספק נמחק / סומן כלא פעיל');
      onRefresh();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          setForm(emptyForm);
          setEditingId(null);
          setShowForm(!showForm);
        }}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
      >
        <Plus className="w-4 h-4" />
        ספק חדש
      </button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם ספק *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="שם הספק"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">טלפון</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="מספר טלפון"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">הערות</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="הערות"
            />
          </div>
          <div className="sm:col-span-3 flex gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'עדכן' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition"
            >
              <X className="w-4 h-4" />
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {suppliers.length === 0 ? (
          <p className="p-6 text-slate-400 text-center">אין ספקים להצגה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">שם</th>
                  <th className="px-4 py-3 text-right font-medium">טלפון</th>
                  <th className="px-4 py-3 text-right font-medium">הערות</th>
                  <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                  <th className="px-4 py-3 text-center font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s._id} className={`hover:bg-slate-50 transition ${!s.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      {s.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {s.phone}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          s.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {s.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="text-blue-600 hover:text-blue-800 transition"
                          title="ערוך"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s._id)}
                          className="text-red-500 hover:text-red-700 transition"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  מודל היסטוריה לספק בודד
// ═══════════════════════════════════════════════

function HistoryModal({ data, onClose }) {
  const { supplier, history, summary } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold">היסטוריה — {supplier.name}</h2>
            {supplier.phone && (
              <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3" /> {supplier.phone}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-100">
          <div className="text-center">
            <p className="text-sm text-slate-500">סה״כ עבודה</p>
            <p className="text-lg font-bold">{formatCurrency(summary.totalWork)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">שולם</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">יתרת חוב</p>
            <p className={`text-lg font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <p className="text-slate-400 text-center">אין היסטוריה</p>
          ) : (
            <div className="space-y-3">
              {history.map((item, i) => (
                <div
                  key={item._id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    item.type === 'work_order' ? 'bg-blue-50' : 'bg-green-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'work_order' ? 'bg-blue-200 text-blue-700' : 'bg-green-200 text-green-700'
                  }`}>
                    {item.type === 'work_order' ? <Package className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{item.description}</p>
                      <span className="text-xs text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`font-bold text-sm ${
                        item.amount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(item.amount))}
                      </span>
                      <span className="text-xs text-slate-500">
                        יתרה: {formatCurrency(item.runningBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
