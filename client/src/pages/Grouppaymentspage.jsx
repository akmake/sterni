import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import usePaymentStore from '@/stores/Paymentstore';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'react-hot-toast';
import {
  DollarSign, Plus, CheckCircle2, Clock, XCircle, AlertTriangle,
  Upload, FileText, Image as ImageIcon, Trash2, Eye, ChevronDown,
  ChevronUp, Edit2, Download, Filter, Search, ArrowLeft,
  Receipt, CreditCard, Banknote, Building2, Landmark, HelpCircle,
  BadgeCheck, X, RotateCcw, TrendingUp, Calendar, User,
  Paperclip, ZoomIn,
} from 'lucide-react';

// ═══════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════
const PAYMENT_TYPES = {
  invoice: { label: 'חשבונית', icon: Receipt, color: 'text-blue-600' },
  receipt: { label: 'קבלה', icon: FileText, color: 'text-green-600' },
  transfer: { label: 'העברה בנקאית', icon: Landmark, color: 'text-purple-600' },
  check: { label: 'צ\'ק', icon: Banknote, color: 'text-amber-600' },
  cash: { label: 'מזומן', icon: DollarSign, color: 'text-emerald-600' },
  credit_card: { label: 'כרטיס אשראי', icon: CreditCard, color: 'text-indigo-600' },
  other: { label: 'אחר', icon: HelpCircle, color: 'text-gray-600' },
};

const STATUS_CONFIG = {
  pending: { label: 'ממתין לאישור', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  confirmed: { label: 'מאושר', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'נדחה', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  cancelled: { label: 'בוטל', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: X },
};

const OVERALL_STATUS = {
  paid_full: { label: 'שולם במלואו', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  partial: { label: 'שולם חלקית', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  pending: { label: 'ממתין לתשלום', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  unpaid: { label: 'לא שולם', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  no_billing: { label: 'לא הוגדר חיוב', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
};

const formatCurrency = (amount, currency = 'ILS') => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

// ═══════════════════════════════════════════════
// StatusBadge
// ═══════════════════════════════════════════════
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════
// FinancialSummaryCards
// ═══════════════════════════════════════════════
function FinancialSummaryCards({ summary, billing }) {
  if (!summary) return null;
  const ov = OVERALL_STATUS[summary.overallStatus] || OVERALL_STATUS.no_billing;

  return (
    <div className="space-y-4">
      {/* Overall status banner */}
      {summary.isOverdue && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <span className="font-bold">תשלום באיחור!</span>
            <span className="mr-2 text-sm">תאריך יעד: {formatDate(summary.dueDate)}</span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* סה"כ צפוי */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium">
            <TrendingUp size={14} />
            סה"כ לחיוב
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.totalExpected)}
          </div>
          {summary.discountAmount > 0 && (
            <div className="text-xs text-green-600">הנחה: {formatCurrency(summary.discountAmount)}</div>
          )}
        </div>

        {/* שולם (מאושר) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
            <CheckCircle2 size={14} />
            שולם (מאושר)
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {formatCurrency(summary.confirmedTotal)}
          </div>
        </div>

        {/* ממתין */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
            <Clock size={14} />
            ממתין לאישור
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {formatCurrency(summary.pendingTotal)}
          </div>
        </div>

        {/* יתרה */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium">
            <DollarSign size={14} />
            יתרה לתשלום
          </div>
          <div className={`text-2xl font-bold ${summary.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(summary.remaining)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {summary.totalExpected > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${ov.color}`}>{ov.label}</span>
            <span className="text-sm font-bold text-gray-700">{summary.paidPercentage}%</span>
          </div>
          <div className="relative h-4 rounded-full bg-gray-100 overflow-hidden">
            {/* Confirmed portion */}
            <div
              className="absolute inset-y-0 right-0 bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.paidPercentage)}%` }}
            />
            {/* Pending portion */}
            {summary.pendingTotal > 0 && summary.totalExpected > 0 && (
              <div
                className="absolute inset-y-0 bg-amber-400/60 rounded-r-full transition-all duration-700"
                style={{
                  right: `${Math.min(100, summary.paidPercentage)}%`,
                  width: `${Math.min(100 - summary.paidPercentage, (summary.pendingTotal / summary.totalExpected) * 100)}%`,
                }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> מאושר</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> ממתין</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200" /> נותר</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// AddPaymentForm
// ═══════════════════════════════════════════════
function AddPaymentForm({ groupId, onClose }) {
  const { addPayment, uploading } = usePaymentStore();
  const [form, setForm] = useState({
    type: 'transfer',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    description: '',
    status: 'pending',
    internalNotes: '',
  });
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('נא להזין סכום תקין');
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (val !== '' && val !== undefined) formData.append(key, val);
    });
    files.forEach(f => formData.append('attachments', f));

    try {
      await addPayment(groupId, formData);
      onClose();
    } catch (e) { /* error handled in store */ }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            רישום תשלום חדש
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* סוג תשלום */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">סוג תשלום</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PAYMENT_TYPES).map(([key, { label, icon: Icon, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-xs font-medium
                    ${form.type === key ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* סכום + תאריך */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סכום *</label>
              <div className="relative">
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-lg font-bold text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך תשלום *</label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* מספר אסמכתא */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מספר אסמכתא</label>
            <input
              type="text"
              value={form.referenceNumber}
              onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
              placeholder="מספר חשבונית / קבלה / צ'ק..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* תיאור */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="תיאור קצר של התשלום..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* הערות פנימיות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות פנימיות</label>
            <textarea
              value={form.internalNotes}
              onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))}
              placeholder="הערות שלא נראות ללקוח..."
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* העלאת קבצים - Drag & Drop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              אסמכתאות (תמונות, PDF, מסמכים)
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])}
                className="hidden"
              />
              <Upload size={24} className={`mx-auto mb-2 ${dragOver ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-500">
                גרור קבצים לכאן או <span className="text-blue-600 font-medium">לחץ לבחירה</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">תמונות, PDF, Word, Excel — עד 10MB לקובץ</p>
            </div>

            {/* רשימת קבצים */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700 truncate">
                      {f.type?.startsWith('image') ? <ImageIcon size={14} /> : <FileText size={14} />}
                      <span className="truncate">{f.name}</span>
                      <span className="text-gray-400 text-xs">({(f.size / 1024).toFixed(0)}KB)</span>
                    </div>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* כפתורים */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={uploading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold">
              {uploading ? (
                <span className="flex items-center gap-2"><RotateCcw size={16} className="animate-spin" /> שומר...</span>
              ) : (
                <span className="flex items-center gap-2"><Plus size={16} /> רשום תשלום</span>
              )}
            </Button>
            <Button type="button" onClick={onClose} variant="outline" className="px-6 py-2.5 rounded-xl">
              ביטול
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BillingProfileEditor
// ═══════════════════════════════════════════════
function BillingProfileEditor({ groupId, billing, onClose }) {
  const { updateBilling } = usePaymentStore();
  const [form, setForm] = useState({
    totalExpected: billing?.totalExpected || 0,
    vatRate: billing?.vatRate ?? 17,
    includesVat: billing?.includesVat ?? true,
    paymentTerms: billing?.paymentTerms || 'immediate',
    dueDate: billing?.dueDate ? new Date(billing.dueDate).toISOString().slice(0, 10) : '',
    discountType: billing?.discount?.type || 'fixed',
    discountValue: billing?.discount?.value || 0,
    discountReason: billing?.discount?.reason || '',
    notes: billing?.notes || '',
  });

  const handleSave = async () => {
    try {
      await updateBilling(groupId, {
        totalExpected: Number(form.totalExpected),
        vatRate: Number(form.vatRate),
        includesVat: form.includesVat,
        paymentTerms: form.paymentTerms,
        dueDate: form.dueDate || null,
        discount: {
          type: form.discountType,
          value: Number(form.discountValue),
          reason: form.discountReason,
        },
        notes: form.notes,
      });
      onClose();
    } catch (e) { /* handled in store */ }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Edit2 size={18} className="text-blue-600" />
            הגדרות חיוב
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* סכום צפוי */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סכום כולל לחיוב *</label>
            <div className="relative">
              <input
                type="number"
                value={form.totalExpected}
                onChange={e => setForm(f => ({ ...f, totalExpected: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xl font-bold text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
            </div>
          </div>

          {/* מע"מ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מע"מ %</label>
              <input
                type="number"
                value={form.vatRate}
                onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includesVat}
                  onChange={e => setForm(f => ({ ...f, includesVat: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">כולל מע"מ</span>
              </label>
            </div>
          </div>

          {/* הנחה */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סוג הנחה</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="fixed">סכום קבוע</option>
                <option value="percentage">אחוזים</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ערך הנחה</label>
              <input
                type="number"
                value={form.discountValue}
                onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סיבה</label>
              <input
                type="text"
                value={form.discountReason}
                onChange={e => setForm(f => ({ ...f, discountReason: e.target.value }))}
                placeholder="סיבת ההנחה"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* תנאי תשלום */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תנאי תשלום</label>
              <select
                value={form.paymentTerms}
                onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="immediate">מיידי</option>
                <option value="net_15">שוטף + 15</option>
                <option value="net_30">שוטף + 30</option>
                <option value="net_60">שוטף + 60</option>
                <option value="custom">מותאם</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך יעד</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* הערות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold">
              שמור הגדרות
            </Button>
            <Button onClick={onClose} variant="outline" className="px-6 py-2.5 rounded-xl">
              ביטול
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// AttachmentViewer
// ═══════════════════════════════════════════════
function AttachmentViewer({ attachment, onClose }) {
  const isImage = attachment.mimetype?.startsWith('image');
  const url = attachment.path;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -left-3 bg-white rounded-full p-1 shadow-lg z-10">
          <X size={20} />
        </button>
        {isImage ? (
          <img src={url} alt={attachment.originalName} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
        ) : (
          <div className="bg-white rounded-xl p-8 text-center space-y-4">
            <FileText size={48} className="mx-auto text-gray-400" />
            <p className="font-medium text-gray-700">{attachment.originalName}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Download size={16} />
              הורד קובץ
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// PaymentCard
// ═══════════════════════════════════════════════
function PaymentCard({ payment, groupId }) {
  const { confirmPayment, rejectPayment, deletePayment } = usePaymentStore();
  const [expanded, setExpanded] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState(null);

  const typeConfig = PAYMENT_TYPES[payment.type] || PAYMENT_TYPES.other;
  const TypeIcon = typeConfig.icon;

  return (
    <>
      <div className={`bg-white rounded-xl border transition-all ${
        payment.status === 'confirmed' ? 'border-emerald-200' :
        payment.status === 'rejected' ? 'border-red-200' :
        'border-gray-200'
      } hover:shadow-md`}>
        {/* Main row */}
        <div
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            payment.status === 'confirmed' ? 'bg-emerald-100' :
            payment.status === 'rejected' ? 'bg-red-100' :
            'bg-gray-100'
          }`}>
            <TypeIcon size={18} className={typeConfig.color} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-lg">{formatCurrency(payment.amount)}</span>
              <StatusBadge status={payment.status} />
              {payment.attachments?.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Paperclip size={12} />
                  {payment.attachments.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span>{typeConfig.label}</span>
              <span>{formatDate(payment.paymentDate)}</span>
              {payment.referenceNumber && <span>אסמכתא: {payment.referenceNumber}</span>}
            </div>
          </div>

          {/* Expand arrow */}
          <div className="flex-shrink-0">
            {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {payment.description && (
              <div className="text-sm text-gray-600">{payment.description}</div>
            )}

            {payment.internalNotes && (
              <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2">
                <span className="font-medium">הערות פנימיות:</span> {payment.internalNotes}
              </div>
            )}

            {payment.recordedBy && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <User size={12} />
                נרשם ע"י {payment.recordedBy.name}
                {payment.confirmedBy && <> · אושר ע"י {payment.confirmedBy.name}</>}
              </div>
            )}

            {/* Attachments */}
            {payment.attachments?.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500">אסמכתאות:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {payment.attachments.map((att) => {
                    const isImage = att.mimetype?.startsWith('image');
                    return (
                      <div
                        key={att._id}
                        className="relative group bg-gray-50 rounded-lg overflow-hidden cursor-pointer border border-gray-200 hover:border-blue-300 transition-all"
                        onClick={() => setViewingAttachment(att)}
                      >
                        {isImage ? (
                          <div className="relative aspect-video">
                            <img src={att.path} alt={att.originalName} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                              <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video flex flex-col items-center justify-center gap-1 p-2">
                            <FileText size={24} className="text-gray-400" />
                            <span className="text-xs text-gray-500 truncate w-full text-center">{att.originalName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {payment.status === 'pending' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); confirmPayment(payment._id, groupId); }}
                    className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <BadgeCheck size={14} /> אשר תשלום
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); rejectPayment(payment._id, '', groupId); }}
                    className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors font-medium"
                  >
                    <XCircle size={14} /> דחה
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('למחוק את התשלום?')) deletePayment(payment._id, groupId);
                }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 px-2 py-1.5 rounded-lg transition-colors mr-auto"
              >
                <Trash2 size={14} /> מחק
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attachment viewer */}
      {viewingAttachment && (
        <AttachmentViewer attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />
      )}
    </>
  );
}


// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function GroupPaymentsPage() {
  const { groupId } = useParams();
  const {
    payments, billing, summary, groupInfo, loading,
    fetchFinancialSummary,
  } = usePaymentStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showBillingEditor, setShowBillingEditor] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (groupId) fetchFinancialSummary(groupId);
  }, [groupId]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = payments || [];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p =>
        (p.description || '').toLowerCase().includes(q) ||
        (p.referenceNumber || '').toLowerCase().includes(q) ||
        (p.internalNotes || '').toLowerCase().includes(q) ||
        String(p.amount).includes(q)
      );
    }
    return filtered;
  }, [payments, statusFilter, searchQuery]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RotateCcw size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${groupId}`} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {groupInfo?.name || 'קבוצה'}
            </h1>
            <p className="text-sm text-gray-500">ניהול תשלומים ומעקב כספי</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowBillingEditor(true)}
            variant="outline"
            className="rounded-xl text-sm"
          >
            <Edit2 size={14} className="ml-1" />
            הגדרות חיוב
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
          >
            <Plus size={16} className="ml-1" />
            רישום תשלום
          </Button>
        </div>
      </div>

      {/* Financial Summary */}
      <FinancialSummaryCards summary={summary} billing={billing} />

      {/* Payments list header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            תשלומים ({filteredPayments.length})
          </h2>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש..."
                className="border border-gray-300 rounded-lg pr-9 pl-3 py-1.5 text-sm w-44 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
              {[
                { key: 'all', label: 'הכל' },
                { key: 'pending', label: 'ממתין' },
                { key: 'confirmed', label: 'מאושר' },
                { key: 'rejected', label: 'נדחה' },
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
        </div>

        {/* Payment cards */}
        {filteredPayments.length > 0 ? (
          <div className="space-y-2">
            {filteredPayments.map(p => (
              <PaymentCard key={p._id} payment={p} groupId={groupId} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <DollarSign size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {payments?.length === 0 ? 'עדיין לא נרשמו תשלומים' : 'אין תוצאות לסינון'}
            </p>
            {payments?.length === 0 && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                <Plus size={16} className="ml-1" />
                רשום תשלום ראשון
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddForm && (
        <AddPaymentForm groupId={groupId} onClose={() => setShowAddForm(false)} />
      )}
      {showBillingEditor && (
        <BillingProfileEditor
          groupId={groupId}
          billing={billing}
          onClose={() => setShowBillingEditor(false)}
        />
      )}
    </div>
  );
}