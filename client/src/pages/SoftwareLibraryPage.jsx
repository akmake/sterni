import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor, Upload, Download, Trash2, Search, X, Plus, HardDrive,
  ChevronRight, Save, AlertCircle, Check, Edit2, Tag, Palette,
  GripVertical, ListOrdered, FileDown, Settings2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';

// ─── פלטת צבעים לקטגוריות ─────────────────────────────────────────────────────
const COLOR_PALETTE = [
  '#3B82F6','#10B981','#EF4444','#F59E0B','#8B5CF6',
  '#EC4899','#06B6D4','#F97316','#6366F1','#14B8A6',
  '#84CC16','#6B7280',
];

// ─── עזרים ───────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getExt(filename) {
  if (!filename) return '?';
  return filename.split('.').pop()?.toUpperCase().slice(0, 5) || '?';
}

// ─── מודל ניהול קטגוריות ─────────────────────────────────────────────────────
function CategoryManager({ categories, onClose, onChanged }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState(null);

  const handleAdd = async () => {
    if (!name.trim()) { toast.error('הכנס שם קטגוריה'); return; }
    setSaving(true);
    try {
      await api.post('/software/categories', { name: name.trim(), color });
      setName('');
      toast.success('קטגוריה נוספה');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally { setSaving(false); }
  };

  const handleDelete = async (catName) => {
    setDeletingName(catName);
    try {
      await api.delete(`/software/categories/${encodeURIComponent(catName)}`);
      toast.success('קטגוריה נמחקה');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally { setDeletingName(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Tag size={18} className="text-violet-600" />
            </div>
            <h2 className="font-bold text-gray-900">ניהול קטגוריות</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Existing categories */}
        <div className="p-5 space-y-2 max-h-56 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">אין קטגוריות עדיין</p>
          )}
          {categories.map(cat => (
            <div key={cat.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 group">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.name)}
                disabled={deletingName === cat.name}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
              >
                {deletingName === cat.name
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Trash2 size={14} />
                }
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="p-5 border-t space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">הוסף קטגוריה</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="שם הקטגוריה..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
          />
          {/* Color picker */}
          <div>
            <p className="text-xs text-gray-500 mb-2">בחר צבע</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={16} />}
            הוסף קטגוריה
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── מגירת הוראות התקנה ───────────────────────────────────────────────────────
function InstructionsDrawer({ item, onClose, onSaved }) {
  const [steps, setSteps] = useState(item.installSteps?.length ? [...item.installSteps] : ['']);
  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);
  const endRef = useRef(null);

  const addStep = () => {
    setSteps(prev => [...prev, '']);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const updateStep = (i, val) => setSteps(prev => prev.map((s, idx) => idx === i ? val : s));
  const removeStep = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanSteps = steps.map(s => s.trim()).filter(Boolean);
      await api.patch(`/software/${item.id}`, { installSteps: cleanSteps, notes });
      toast.success('הוראות נשמרו');
      onSaved({ ...item, installSteps: cleanSteps, notes });
      onClose();
    } catch {
      toast.error('שגיאה בשמירה');
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-full sm:w-[460px] bg-white shadow-2xl flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <ListOrdered size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">הוראות התקנה</h2>
            <p className="text-xs text-gray-500 truncate">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">שלבי התקנה</p>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-6 h-6 mt-2 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <textarea
                    value={step}
                    onChange={e => updateStep(i, e.target.value)}
                    placeholder={`שלב ${i + 1}...`}
                    rows={2}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none leading-relaxed"
                  />
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(i)}
                      className="shrink-0 mt-2 p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <button
              onClick={addStep}
              className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus size={16} />
              הוסף שלב
            </button>
          </div>

          {/* Notes / License */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">הערות נוספות</p>
            <p className="text-xs text-gray-400 mb-2">מפתחות רישיון, הגדרות, כתובות שרת...</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הערות, מפתח רישיון, סיסמאות..."
              rows={5}
              className="w-full border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none leading-relaxed font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={16} />
            }
            שמור הוראות
          </button>
          <button onClick={onClose} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </>
  );
}

// ─── מודל העלאה / עריכה ───────────────────────────────────────────────────────
function UploadModal({ editItem, categories, onClose, onSaved }) {
  const isEditing = !!editItem;
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: editItem?.title || '',
    description: editItem?.description || '',
    version: editItem?.version || '',
    category: editItem?.category || '',
  });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleFile = f => {
    if (!f) return;
    setFile(f);
    if (!form.title) {
      setForm(prev => ({ ...prev, title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') }));
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('שם התוכנה חובה'); return; }
    if (!isEditing && !file) { toast.error('יש לבחור קובץ'); return; }

    setUploading(true);
    setProgress(0);
    try {
      let data;
      if (isEditing) {
        const res = await api.patch(`/software/${editItem.id}`, form);
        data = res.data.data;
        toast.success('עודכן בהצלחה');
      } else {
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        const res = await api.post('/software', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: evt => { if (evt.total) setProgress(Math.round(evt.loaded / evt.total * 100)); },
        });
        data = res.data.data;
        toast.success('הועלה בהצלחה!');
      }
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              {isEditing ? <Edit2 size={18} className="text-blue-600" /> : <Upload size={18} className="text-blue-600" />}
            </div>
            <h2 className="font-bold text-gray-900">{isEditing ? 'עריכת פרטים' : 'העלאת תוכנה'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          {!isEditing && (
            <div
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragging ? 'border-blue-500 bg-blue-50' :
                file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef} type="file" className="hidden"
                onChange={e => handleFile(e.target.files[0])}
                accept=".exe,.msi,.zip,.7z,.rar,.iso,.dmg,.pkg,.deb,.rpm,.tar,.gz,.apk,.bat,.sh,.ps1,.cab,.msix,.appx"
              />
              {file ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check size={20} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-green-700 text-sm truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-green-600">{formatSize(file.size)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">גרור קובץ לכאן או לחץ לבחירה</p>
                  <p className="text-xs text-gray-400">exe · msi · zip · iso · dmg · ועוד · עד 2GB</p>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {uploading && !isEditing && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>מעלה לשרת...</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם התוכנה <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={set('title')} placeholder="למשל: TeamViewer"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>

          {/* Version + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">גרסה</label>
              <input type="text" value={form.version} onChange={set('version')} placeholder="15.0.1" dir="ltr"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
              <select value={form.category} onChange={set('category')}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                <option value="">ללא קטגוריה</option>
                {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור קצר</label>
            <textarea value={form.description} onChange={set('description')} placeholder="מה התוכנה עושה..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
          </div>

          {isEditing && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
              💡 לעריכת הוראות התקנה — לחץ על "הוראות" בכרטיס התוכנה
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t">
          <button onClick={handleSubmit} disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60">
            {uploading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{isEditing ? 'שומר...' : `${progress}%`}</>
              : <>{isEditing ? <Save size={16} /> : <Upload size={16} />}{isEditing ? 'שמור' : 'העלה תוכנה'}</>
            }
          </button>
          <button onClick={onClose} disabled={uploading} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── מודל מחיקה ───────────────────────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">מחיקת תוכנה</h3>
          <p className="text-sm text-gray-500 mt-1">
            למחוק את <span className="font-semibold text-gray-700">"{item.title}"</span>?
            <br /><span className="text-red-500">הקובץ יימחק לצמיתות מהשרת.</span>
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={async () => { setDeleting(true); await onConfirm(item); }}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60">
            {deleting ? 'מוחק...' : 'מחיקה'}
          </button>
          <button onClick={onClose} disabled={deleting} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── כרטיס תוכנה ─────────────────────────────────────────────────────────────
function SoftwareCard({ item, categories, currentUser, onDelete, onEdit, onDownload, onInstructions }) {
  const cat = categories.find(c => c.name === item.category);
  const ext = getExt(item.originalFilename);
  const isOwner = item.uploadedBy?._id?.toString() === currentUser?._id?.toString();
  const canModify = isOwner || currentUser?.role === 'admin';
  const stepCount = item.installSteps?.filter(Boolean).length || 0;
  const hasInstructions = stepCount > 0 || item.notes?.trim();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Top strip — category color */}
      <div className="h-1 w-full" style={{ backgroundColor: cat?.color || '#E5E7EB' }} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Extension badge */}
          <div className="shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white font-black text-xs leading-none shadow-sm"
            style={{ backgroundColor: cat?.color || '#9CA3AF' }}>
            <span className="text-[10px] font-bold opacity-80">.{ext}</span>
            <FileDown size={18} className="mt-0.5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.version && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">v{item.version}</span>
              )}
              {cat && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                  {cat.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {item.description ? (
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{item.description}</p>
        ) : (
          <p className="text-sm text-gray-300 italic">ללא תיאור</p>
        )}

        {/* Instructions hint */}
        {hasInstructions && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
            <ListOrdered size={13} />
            {stepCount > 0 ? `${stepCount} שלבי התקנה` : ''}
            {stepCount > 0 && item.notes?.trim() ? ' · ' : ''}
            {item.notes?.trim() ? 'הערות' : ''}
          </div>
        )}

        {/* Footer meta */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-1 border-t border-gray-50">
          <span className="font-mono font-semibold text-gray-600">{formatSize(item.size)}</span>
          <span>·</span>
          <span>{item.downloadCount || 0} הורדות</span>
          <span>·</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => onDownload(item)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Download size={15} />הורדה
        </button>
        <button onClick={() => onInstructions(item)}
          title="הוראות התקנה"
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
            hasInstructions
              ? 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
              : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}>
          <ListOrdered size={15} />
        </button>
        {canModify && (
          <>
            <button onClick={() => onEdit(item)} title="עריכה"
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onDelete(item)} title="מחיקה"
              className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl border border-gray-200 transition-colors">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── דף ראשי ─────────────────────────────────────────────────────────────────
export default function SoftwareLibraryPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [instructionsItem, setInstructionsItem] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // טעינת קטגוריות
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/software/categories');
      setCategories(res.data.data || []);
    } catch { /* שקט */ }
  }, []);

  // טעינת תוכנות
  const fetchSoftware = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeCategory) params.category = activeCategory;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/software', { params });
      setItems(res.data.data || []);
    } catch {
      toast.error('שגיאה בטעינת הספרייה');
    } finally { setLoading(false); }
  }, [activeCategory, search]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  useEffect(() => {
    const t = setTimeout(fetchSoftware, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchSoftware]);

  const handleDownload = (item) => {
    window.open(`/api/software/${item.id}/download`, '_blank');
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, downloadCount: (i.downloadCount || 0) + 1 } : i));
  };

  const handleDelete = async (item) => {
    try {
      await api.delete(`/software/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setDeleteItem(null);
      toast.success('נמחק');
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    }
  };

  const handleUploadSaved = (newItem) => {
    setShowUpload(false);
    setEditItem(null);
    if (newItem.installSteps?.length === 0 && !newItem.notes) {
      // פותח את מגירת ההוראות אחרי העלאה
      setInstructionsItem(newItem);
    }
    setItems(prev => {
      const exists = prev.find(i => i.id === newItem.id);
      return exists ? prev.map(i => i.id === newItem.id ? newItem : i) : [newItem, ...prev];
    });
  };

  const handleInstructionsSaved = (updated) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  // סטטיסטיקות
  const totalSize = items.reduce((s, i) => s + (i.size || 0), 0);
  const totalDownloads = items.reduce((s, i) => s + (i.downloadCount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5" dir="rtl">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow">
            <Monitor size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ספריית תוכנות</h1>
            <p className="text-xs text-gray-400">ניהול תוכנות להתקנה על מחשבים</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Settings2 size={15} />
            קטגוריות
          </button>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors">
            <Plus size={16} />
            הוסף תוכנה
          </button>
        </div>
      </div>

      {/* ─── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'תוכנות', value: items.length, icon: Monitor, bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'נפח כולל', value: formatSize(totalSize), icon: HardDrive, bg: 'bg-purple-50', text: 'text-purple-600' },
          { label: 'הורדות', value: totalDownloads, icon: Download, bg: 'bg-green-50', text: 'text-green-600' },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
              <Icon size={18} className={text} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-base font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, תיאור, הוראות..."
            className="w-full pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveCategory('')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${!activeCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              הכל
            </button>
            {categories.map(cat => (
              <button key={cat.name} onClick={() => setActiveCategory(activeCategory === cat.name ? '' : cat.name)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                  activeCategory === cat.name ? 'text-white border-transparent shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                style={activeCategory === cat.name ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeCategory === cat.name ? 'white' : cat.color }} />
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Grid ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Monitor size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-600">{search || activeCategory ? 'לא נמצאו תוכנות' : 'הספרייה ריקה'}</p>
            <p className="text-sm text-gray-400 mt-1">{search || activeCategory ? 'נסה לשנות את הסינון' : 'לחץ על "הוסף תוכנה" להתחלה'}</p>
          </div>
          {!search && !activeCategory && (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <Plus size={16} />הוסף תוכנה ראשונה
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <SoftwareCard
              key={item.id}
              item={item}
              categories={categories}
              currentUser={user}
              onDelete={setDeleteItem}
              onEdit={setEditItem}
              onDownload={handleDownload}
              onInstructions={setInstructionsItem}
            />
          ))}
        </div>
      )}

      {/* ─── Modals & Drawers ──────────────────────────────────────────────── */}
      {(showUpload || editItem) && (
        <UploadModal
          editItem={editItem}
          categories={categories}
          onClose={() => { setShowUpload(false); setEditItem(null); }}
          onSaved={handleUploadSaved}
        />
      )}
      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} />
      )}
      {instructionsItem && (
        <InstructionsDrawer
          item={instructionsItem}
          onClose={() => setInstructionsItem(null)}
          onSaved={handleInstructionsSaved}
        />
      )}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onChanged={() => { fetchCategories(); fetchSoftware(); }}
        />
      )}
    </div>
  );
}
