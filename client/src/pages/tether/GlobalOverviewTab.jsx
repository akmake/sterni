// Super-admin only — web port of the Android admin app's GlobalOverviewScreen: every device and
// community in the system (any admin, active or not), with rename and hard delete.
import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Smartphone, Users, Pencil, Trash2, Check, Clock, ShieldCheck, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import { ConfirmDialog, ProtectionChips, fmtDateTime } from './ui';

export default function GlobalOverviewTab() {
  const [devices, setDevices] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('devices');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind, item }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        tetherApi.get('/admin/global/devices', { headers: authHeader() }),
        tetherApi.get('/admin/global/communities', { headers: authHeader() }),
      ]);
      setDevices(dRes.data);
      setCommunities(cRes.data);
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'גישה מותרת למנהל־על בלבד' : 'שגיאה בטעינה');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renameDevice = async (device, nickname) => {
    try {
      await tetherApi.put(`/admin/devices/${device.deviceId}/nickname`, { nickname }, { headers: authHeader() });
      setDevices(list => list.map(d => (d.id === device.id ? { ...d, deviceNickname: nickname } : d)));
      toast.success('שם עודכן');
    } catch { toast.error('שגיאת רשת'); }
  };

  const renameCommunity = async (community, name) => {
    try {
      await tetherApi.put(`/admin/global/communities/${community.id}/rename`, { name }, { headers: authHeader() });
      setCommunities(list => list.map(c => (c.id === community.id ? { ...c, name } : c)));
      toast.success('שם עודכן');
    } catch { toast.error('שגיאת רשת'); }
  };

  const doDelete = async () => {
    const { kind, item } = confirm;
    setConfirm(null);
    try {
      if (kind === 'device') {
        await tetherApi.delete(`/admin/global/devices/${item.id}`, { headers: authHeader() });
        setDevices(list => list.filter(d => d.id !== item.id));
        toast.success('מכשיר נמחק');
      } else {
        await tetherApi.delete(`/admin/global/communities/${item.id}`, { headers: authHeader() });
        setCommunities(list => list.filter(c => c.id !== item.id));
        toast.success('קהילה נמחקה');
      }
    } catch { toast.error('שגיאה במחיקה'); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  const q = query.trim().toLowerCase();
  const has = (v) => v?.toLowerCase().includes(q);
  const shownDevices = !q ? devices : devices.filter(d => has(d.deviceModel) || has(d.deviceNickname) || has(d.communityName) || has(d.deviceId));
  const shownCommunities = !q ? communities : communities.filter(c => has(c.name) || has(c.code) || has(c.adminName));
  const shown = tab === 'devices' ? shownDevices : shownCommunities;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">סקירה גלובלית</h2>
          <p className="text-xs text-gray-400">{devices.length} מכשירים · {communities.length} קהילות</p>
        </div>
        <button onClick={load} aria-label="רענן" className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חפש מכשיר, קהילה, מודל..."
          className="w-full border border-gray-200 rounded-xl pr-9 pl-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {query && <button onClick={() => setQuery('')} aria-label="נקה" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
        {[
          { id: 'devices', label: `מכשירים (${devices.length})`, icon: Smartphone },
          { id: 'communities', label: `קהילות (${communities.length})`, icon: Users },
        ].map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg ${tab === t.id ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {shown.length} {tab === 'devices' ? 'מכשירים' : 'קהילות'}{q ? ' (מסונן)' : ''}
      </p>

      {shown.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{tab === 'devices' ? 'אין מכשירים' : 'אין קהילות'}</div>
      ) : tab === 'devices' ? (
        <div className="space-y-2">
          {shownDevices.map(d => (
            <EditableCard key={d.id} icon={Smartphone} active={d.active}
              title={d.deviceNickname || d.deviceModel} subtitle={d.deviceNickname ? d.deviceModel : null}
              initialName={d.deviceNickname || ''} placeholder="שם המכשיר" allowEmpty
              onRename={nick => renameDevice(d, nick || null)} onDelete={() => setConfirm({ kind: 'device', item: d })}>
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <Users size={12} /> {d.communityName}
                {d.communityCode && <><span>·</span><span className="font-mono">{d.communityCode}</span></>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500">
                <Clock size={12} /> {fmtDateTime(d.lastSeen)}
                <span className="flex-1" />
                <Chip ok={d.active}>{d.active ? 'פעיל' : 'מושבת'}</Chip>
                {d.isOnline && <Chip ok>מחובר</Chip>}
              </div>
              <ProtectionChips status={d.protectionStatus} isDeviceOwner={d.isDeviceOwner} />
            </EditableCard>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {shownCommunities.map(c => (
            <EditableCard key={c.id} icon={Users} active={c.active} title={c.name} subtitle={c.code} subtitleMono
              initialName={c.name} placeholder="שם הקהילה"
              onRename={name => renameCommunity(c, name)} onDelete={() => setConfirm({ kind: 'community', item: c })}>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><ShieldCheck size={12} /> {c.adminName}</span>
                <span className="flex items-center gap-1"><Smartphone size={12} /> {c.activeDeviceCount}/{c.deviceCount} פעילים</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <Chip ok={c.active}>{c.active ? 'פעילה' : 'מושבתת'}</Chip>
                <span className="flex-1" />
                <Calendar size={11} className="ml-1" /> {new Date(c.createdAt).toLocaleDateString('he-IL')}
              </div>
            </EditableCard>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'device' ? 'מחק מכשיר?' : 'מחק קהילה?'} confirmLabel="מחק" icon={Trash2}
          text={confirm.kind === 'device'
            ? `"${confirm.item.deviceNickname || confirm.item.deviceModel}" ימחק לצמיתות.`
            : `"${confirm.item.name}" תימחק לצמיתות. כל המכשירים המשויכים יישארו ללא קהילה.`}
          onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

function Chip({ ok, children }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded ${ok ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{children}</span>;
}

function EditableCard({ icon: Icon, active, title, subtitle, subtitleMono, initialName, placeholder, allowEmpty, onRename, onDelete, children }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const save = () => {
    if (!allowEmpty && !name.trim()) return;
    onRename(name.trim());
    setEditing(false);
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon size={17} className={active ? 'text-blue-700' : 'text-gray-400'} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-1">
              <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder={placeholder}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm" />
              <button onClick={save} aria-label="שמור" className="p-1 text-blue-700"><Check size={16} /></button>
              <button onClick={() => setEditing(false)} aria-label="ביטול" className="p-1 text-gray-400"><X size={16} /></button>
            </div>
          ) : (
            <>
              <div className="font-semibold text-sm text-gray-900 truncate">{title}</div>
              {subtitle && <div className={`text-xs ${subtitleMono ? 'font-mono text-blue-700' : 'text-gray-500'}`}>{subtitle}</div>}
            </>
          )}
        </div>
        {!editing && (
          <>
            <button onClick={() => { setName(initialName); setEditing(true); }} aria-label="ערוך שם" className="p-1.5 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
            <button onClick={onDelete} aria-label="מחק" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
          </>
        )}
      </div>
      {children}
    </div>
  );
}
