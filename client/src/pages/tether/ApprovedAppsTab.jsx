// Super-admin only — web port of the Android admin app's ApprovedAppsCatalogScreen: the apps
// devices may install from Tether (package, version, download URL), with add / edit / activate.
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, AppWindow, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import { Modal, Switch, ConfirmDialog } from './ui';

const appId = (app) => app._id || app.id;

export default function ApprovedAppsTab() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | app
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/apps/approved', { headers: authHeader() });
      setApps(data);
    } catch { toast.error('שגיאה בטעינת הקטלוג'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const errorOf = (err, fallback) => (err.response?.status === 403 ? 'פעולה זו מותרת למנהל־על בלבד' : err.response?.data?.message || fallback);

  const save = async (payload) => {
    try {
      if (editing === 'new') await tetherApi.post('/admin/apps/approved', payload, { headers: authHeader() });
      else await tetherApi.put(`/admin/apps/approved/${appId(editing)}`, payload, { headers: authHeader() });
      toast.success(editing === 'new' ? 'האפליקציה נשמרה' : 'האפליקציה עודכנה');
      setEditing(null);
      load();
    } catch (err) { toast.error(errorOf(err, 'שמירת האפליקציה נכשלה')); }
  };

  const setActive = async (app, active) => {
    try {
      await tetherApi.put(`/admin/apps/approved/${appId(app)}`, { active }, { headers: authHeader() });
      setApps(list => list.map(a => (appId(a) === appId(app) ? { ...a, active } : a)));
    } catch (err) { toast.error(errorOf(err, 'העדכון נכשל')); }
  };

  const deactivate = async (app) => {
    setConfirmDeactivate(null);
    try {
      await tetherApi.delete(`/admin/apps/approved/${appId(app)}`, { headers: authHeader() });
      toast.success('האפליקציה הושבתה');
      load();
    } catch (err) { toast.error(errorOf(err, 'ההשבתה נכשלה')); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">קטלוג אפליקציות מאושרות ({apps.length})</h2>
          <p className="text-xs text-gray-400">אפליקציות שמכשירים יכולים להתקין דרך Tether</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} aria-label="רענן" className="text-gray-400 hover:text-gray-600 p-1"><RefreshCw size={16} /></button>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800"><Plus size={15} /> הוסף אפליקציה</button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <AppWindow size={40} className="mx-auto mb-3 opacity-40" />
          <p>אין אפליקציות מאושרות בקטלוג</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map(app => (
            <div key={appId(app)} className={`bg-white border rounded-xl p-4 ${app.active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
              <div className="flex items-start gap-3">
                {app.iconUrl
                  ? <img src={app.iconUrl} alt="" className="w-10 h-10 rounded-lg" />
                  : <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><AppWindow size={18} /></span>}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{app.appName}</div>
                  <div className="text-xs text-gray-500 font-mono" dir="ltr">{app.packageName}</div>
                  <div className="text-xs text-gray-500">גרסה: {app.versionCode}</div>
                  <div className="text-xs text-gray-400 truncate" dir="ltr">{app.downloadUrl}</div>
                </div>
                <button onClick={() => setEditing(app)} aria-label="ערוך" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Pencil size={15} /></button>
                <button onClick={() => setConfirmDeactivate(app)} aria-label="השבת" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 mt-3 pt-2">
                <span className="text-sm text-gray-700">פעילה</span>
                <Switch checked={!!app.active} onChange={v => setActive(app, v)} label="פעילה" />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <AppEditDialog initial={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
      {confirmDeactivate && (
        <ConfirmDialog title="השבתת אפליקציה" confirmLabel="השבת"
          text={`להשבית את "${confirmDeactivate.appName}"? היא לא תוצע עוד למכשירים.`}
          onConfirm={() => deactivate(confirmDeactivate)} onCancel={() => setConfirmDeactivate(null)} />
      )}
    </div>
  );
}

function AppEditDialog({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    packageName: initial?.packageName || '',
    appName: initial?.appName || '',
    versionCode: String(initial?.versionCode ?? 1),
    downloadUrl: initial?.downloadUrl || '',
    iconUrl: initial?.iconUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: k === 'versionCode' ? e.target.value.replace(/\D/g, '') : e.target.value }));
  const valid = form.packageName.trim() && form.appName.trim() && form.downloadUrl.trim() && parseInt(form.versionCode, 10) >= 1;

  const submit = async () => {
    setSaving(true);
    const payload = {
      packageName: form.packageName.trim(),
      appName: form.appName.trim(),
      versionCode: parseInt(form.versionCode, 10),
      downloadUrl: form.downloadUrl.trim(),
    };
    if (form.iconUrl.trim()) payload.iconUrl = form.iconUrl.trim();
    await onSave(payload);
    setSaving(false);
  };

  const fields = [
    { key: 'packageName', label: 'Package name', ltr: true, disabled: !!initial },
    { key: 'appName', label: 'שם האפליקציה' },
    { key: 'versionCode', label: 'Version code', ltr: true, numeric: true },
    { key: 'downloadUrl', label: 'קישור הורדה', ltr: true },
    { key: 'iconUrl', label: 'קישור לאייקון (רשות)', ltr: true },
  ];

  return (
    <Modal title={initial ? 'עריכת אפליקציה מאושרת' : 'הוספת אפליקציה מאושרת'} onClose={onClose} wide
      footer={<>
        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">ביטול</button>
        <button type="button" disabled={!valid || saving} onClick={submit}
          className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'שומר...' : 'שמור'}</button>
      </>}>
      <div className="space-y-2.5">
        {fields.map(f => (
          <label key={f.key} className="block">
            <span className="text-xs text-gray-500">{f.label}</span>
            <input value={form[f.key]} onChange={set(f.key)} disabled={f.disabled} dir={f.ltr ? 'ltr' : undefined}
              inputMode={f.numeric ? 'numeric' : undefined}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
          </label>
        ))}
      </div>
    </Modal>
  );
}
