// Web port of the Android admin app's CommunityDetailScreen: a header with the community name and
// device count, then tabs — devices, policy, share — plus the community action log.
import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import {
  ArrowRight, Trash2, Smartphone, Shield, Share2, ScrollText, RefreshCw, MessageSquare, LockOpen,
  UserMinus, Pencil, Check, Copy, Lock, AlertTriangle, Search, Ban, CheckCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';
import CommunityPolicyTab from './CommunityPolicyTab';
import ApprovalCard from './ApprovalCard';
import LockCommunityModal from './LockCommunityModal';
import DeviceDetailPanel from './DeviceDetailPanel';
import {
  ConfirmDialog, SendMessageDialog, ProtectionChips, OnlineBadge, Switch, isOnlineNow, deviceName, fmtDateTime,
} from './ui';

const TABS = [
  { id: 'devices', label: 'מכשירים', icon: Smartphone },
  { id: 'policy', label: 'מדיניות', icon: Shield },
  { id: 'share', label: 'שיתוף', icon: Share2 },
  { id: 'logs', label: 'לוג', icon: ScrollText },
];

const COMMAND_TOASTS = { FORCE_SYNC: 'פקודת סנכרון נשלחה', SHOW_MESSAGE: 'ההודעה נשלחה', RELEASE_ALL: 'שחרור מלא נשלח' };

export const resolveApprovalRequest = async (request, body) => {
  await tetherApi.put(`/admin/approvals/${request.id}`, body, { headers: authHeader() });
  toast.success(body.status === 'approved' ? 'אושר' : 'נדחה');
};

export default function CommunityDetail({ communityId, onBack, onDeleted }) {
  const [community, setCommunity] = useState(null);
  const [devices, setDevices] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('devices');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [detRes, appRes] = await Promise.all([
        tetherApi.get(`/admin/communities/${communityId}`, { headers: authHeader() }),
        tetherApi.get(`/admin/communities/${communityId}/approvals`, { headers: authHeader() }),
      ]);
      setCommunity(detRes.data.community);
      setDevices(detRes.data.devices || []);
      setApprovals(appRes.data || []);
    } catch {
      toast.error('שגיאה בטעינת פרטים');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  useEffect(() => { load(); }, [load]);

  const deleteCommunity = async () => {
    setConfirmDelete(false);
    try {
      await tetherApi.delete(`/admin/communities/${communityId}`, { headers: authHeader() });
      toast.success('קהילה נמחקה');
      onDeleted(communityId);
    } catch { toast.error('שגיאה במחיקת קהילה'); }
  };

  const updateDevice = (deviceId, patch) => setDevices(list => list.map(d => (d.deviceId === deviceId ? { ...d, ...patch } : d)));

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;
  if (!community) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>הקהילה לא נטענה</p>
        <button onClick={onBack} className="text-blue-700 text-sm mt-2">חזרה</button>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
        <button onClick={onBack} aria-label="חזרה" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ArrowRight size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{community.name}</div>
          <div className="text-xs text-gray-500">{devices.length} מכשירים</div>
        </div>
        <button onClick={() => load(true)} aria-label="רענן" className={`p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 ${refreshing ? 'animate-spin' : ''}`}><RefreshCw size={16} /></button>
        <button onClick={() => setConfirmDelete(true)} aria-label="מחק קהילה" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition ${
              tab === t.id ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'devices' && (
        <DevicesTab community={community} devices={devices} approvals={approvals}
          onOpen={setSelectedDeviceId} onUpdateDevice={updateDevice}
          onRemoved={id => setDevices(list => list.filter(d => d.deviceId !== id))}
          onApprovalResolved={id => setApprovals(list => list.filter(r => r.id !== id))} />
      )}
      {tab === 'policy' && (
        <CommunityPolicyTab key={community.id} communityId={community.id} policy={community.policy || {}}
          onSaved={policy => setCommunity(c => ({ ...c, policy }))} />
      )}
      {tab === 'share' && <ShareTab community={community} deviceCount={devices.length} />}
      {tab === 'logs' && <LogsTab communityId={community.id} devices={devices} logsEnabled={!!community.policy?.logsEnabled} />}

      {confirmDelete && (
        <ConfirmDialog title="מחק קהילה" icon={Trash2} confirmLabel="מחק"
          text={`למחוק את "${community.name}"? כל המכשירים יאבדו את ההגנה ולא ניתן לשחזר.`}
          onConfirm={deleteCommunity} onCancel={() => setConfirmDelete(false)} />
      )}

      {selectedDeviceId && (
        <DeviceDetailPanel deviceId={selectedDeviceId} onClose={() => setSelectedDeviceId(null)}
          onNicknameUpdated={(id, nick) => updateDevice(id, { deviceNickname: nick || null })}
          onRemoved={id => { setDevices(list => list.filter(d => d.deviceId !== id)); setSelectedDeviceId(null); }} />
      )}
    </div>
  );
}

// ── Devices tab ──────────────────────────────────────────────────────────────

function DevicesTab({ community, devices, approvals, onOpen, onUpdateDevice, onRemoved, onApprovalResolved }) {
  const [showLock, setShowLock] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmRelease, setConfirmRelease] = useState(null);
  const [confirmUninstall, setConfirmUninstall] = useState(null);
  const [messageTo, setMessageTo] = useState(null);
  const [resolving, setResolving] = useState(null);

  const sendCommand = async (device, type, payload = '') => {
    try {
      await tetherApi.post(`/admin/devices/${device.deviceId}/commands`, { type, payload }, { headers: authHeader() });
      toast.success(COMMAND_TOASTS[type] || 'הפקודה נשלחה');
    } catch { toast.error('שגיאה בשליחת פקודה'); }
  };

  const setAllowUninstall = async (device, allow) => {
    try {
      await tetherApi.put(`/admin/devices/${device.deviceId}/allow-uninstall`, { allowUninstall: allow }, { headers: authHeader() });
      onUpdateDevice(device.deviceId, { allowUninstall: allow });
      toast.success(allow ? 'מחיקה אושרה — המשתמש יכול למחוק' : 'מחיקה נחסמה');
    } catch { toast.error('שגיאה'); }
  };

  const removeDevice = async (device) => {
    setConfirmRemove(null);
    try {
      await tetherApi.delete(`/admin/devices/${device.deviceId}`, { headers: authHeader() });
      onRemoved(device.deviceId);
      toast.success('המכשיר הוסר');
    } catch { toast.error('שגיאה בהסרה'); }
  };

  const rename = async (device, nickname) => {
    try {
      await tetherApi.put(`/admin/devices/${device.deviceId}/nickname`, { nickname }, { headers: authHeader() });
      onUpdateDevice(device.deviceId, { deviceNickname: nickname });
    } catch { toast.error('שגיאה בשינוי שם'); }
  };

  const resolve = async (request, body) => {
    setResolving(request.id);
    try {
      await resolveApprovalRequest(request, body);
      onApprovalResolved(request.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally { setResolving(null); }
  };

  const labelOf = (deviceId) => {
    const d = devices.find(x => x.deviceId === deviceId);
    return d ? deviceName(d) : null;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowLock(true)}
          className="flex items-center gap-1.5 bg-red-50 text-red-700 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-red-100">
          <Lock size={15} /> נעילת כל מכשירי הקהילה
        </button>
      </div>

      {approvals.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
            <AlertTriangle size={15} className="text-orange-500" /> בקשות אישור ({approvals.length})
          </h4>
          {approvals.map(req => (
            <ApprovalCard key={req.id} request={{ ...req, deviceLabel: labelOf(req.deviceId) }} onResolve={resolve} busy={resolving === req.id} />
          ))}
        </div>
      )}

      {devices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Smartphone size={44} className="mx-auto mb-3 opacity-40" />
          <p>אין מכשירים עדיין</p>
          <p className="text-xs mt-1">שתף את קוד הקהילה בלשונית "שיתוף"</p>
        </div>
      ) : devices.map(device => (
        <DeviceCard key={device.deviceId} device={device}
          onOpen={() => onOpen(device.deviceId)}
          onSync={() => sendCommand(device, 'FORCE_SYNC')}
          onMessage={() => setMessageTo(device)}
          onRelease={() => setConfirmRelease(device)}
          onRemove={() => setConfirmRemove(device)}
          onToggleUninstall={allow => (allow ? setConfirmUninstall(device) : setAllowUninstall(device, false))}
          onRename={nick => rename(device, nick)} />
      ))}

      {showLock && <LockCommunityModal community={community} onClose={() => setShowLock(false)} />}
      {messageTo && (
        <SendMessageDialog deviceLabel={deviceName(messageTo)} onCancel={() => setMessageTo(null)}
          onSend={msg => { sendCommand(messageTo, 'SHOW_MESSAGE', msg); setMessageTo(null); }} />
      )}
      {confirmRemove && (
        <ConfirmDialog title="הסר מכשיר" icon={UserMinus} confirmLabel="הסר"
          text={`להסיר את "${deviceName(confirmRemove)}"? המכשיר יאבד את ההגנה.`}
          onConfirm={() => removeDevice(confirmRemove)} onCancel={() => setConfirmRemove(null)} />
      )}
      {confirmRelease && (
        <ConfirmDialog title="שחרר ומחק" icon={LockOpen} confirmLabel="שחרר"
          text={`פעולה זו תסיר את כל ההגנות מ"${deviceName(confirmRelease)}" ותפתח אפשרות מחיקה. לא ניתן לבטל.`}
          onConfirm={() => { sendCommand(confirmRelease, 'RELEASE_ALL'); setConfirmRelease(null); }}
          onCancel={() => setConfirmRelease(null)} />
      )}
      {confirmUninstall && (
        <ConfirmDialog title="אפשר הסרת אפליקציה?" confirmLabel="אשר"
          text="פעולה זו תאפשר למשתמש להסיר את Tether מהמכשיר. הגנות יבוטלו תוך דקה."
          onConfirm={() => { setAllowUninstall(confirmUninstall, true); setConfirmUninstall(null); }}
          onCancel={() => setConfirmUninstall(null)} />
      )}
    </div>
  );
}

function DeviceCard({ device, onOpen, onSync, onMessage, onRelease, onRemove, onToggleUninstall, onRename }) {
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState(device.deviceNickname || '');
  const online = device.isOnline ?? isOnlineNow(device.lastSeen);

  const saveNick = () => { onRename(nick.trim() || null); setEditing(false); };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-2">
              <input value={nick} onChange={e => setNick(e.target.value)} autoFocus placeholder="שם מכשיר"
                onKeyDown={e => { if (e.key === 'Enter') saveNick(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm" />
              <button onClick={saveNick} aria-label="שמור" className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"><Check size={16} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button onClick={onOpen} className="font-semibold text-gray-900 truncate hover:text-blue-800 text-right">{deviceName(device)}</button>
                <button onClick={() => { setNick(device.deviceNickname || ''); setEditing(true); }} aria-label="ערוך שם"
                  className="p-0.5 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
              </div>
              {device.deviceNickname && <div className="text-xs text-gray-500">{device.deviceModel}</div>}
              <div className="text-xs text-gray-400 mt-0.5">נראה לאחרונה: {timeAgo(device.lastSeen)}</div>
            </>
          )}
        </div>
        <OnlineBadge online={online} />
      </div>

      <div className="mt-2.5"><ProtectionChips status={device.protectionStatus} isDeviceOwner={device.isDeviceOwner} /></div>

      <div className="border-t border-gray-100 mt-3 pt-3 flex items-center gap-1.5 flex-wrap">
        <IconAction label="סנכרן" onClick={onSync}><RefreshCw size={15} /></IconAction>
        <IconAction label="הודעה" onClick={onMessage}><MessageSquare size={15} /></IconAction>
        <IconAction label="שחרר" onClick={onRelease} danger><LockOpen size={15} /></IconAction>
        <button onClick={onOpen} className="text-xs text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg">ניהול מכשיר</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">הסר-התקנה</span>
        <Switch checked={!!device.allowUninstall} onChange={onToggleUninstall} danger label="אפשר הסרת התקנה" />
        <IconAction label="הסר מכשיר" onClick={onRemove} danger plain><UserMinus size={16} /></IconAction>
      </div>
    </div>
  );
}

function IconAction({ label, onClick, danger, plain, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${
        danger ? (plain ? 'text-red-500 hover:bg-red-50' : 'bg-red-50 text-red-600 hover:bg-red-100') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
      {children}
    </button>
  );
}

// ── Share tab ────────────────────────────────────────────────────────────────

function ShareTab({ community, deviceCount }) {
  const code = community.code || '';
  const formatted = code.length > 4 ? `${code.slice(0, 4)} - ${code.slice(4)}` : code;
  const copy = () => { navigator.clipboard.writeText(code); toast.success('הקוד הועתק!'); };
  const share = async () => {
    const text = `הצטרפות לקהילה "${community.name}" ב-Tether — קוד: ${formatted}`;
    if (navigator.share) {
      try { await navigator.share({ title: community.name, text }); } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(text);
      toast.success('הטקסט הועתק לשיתוף');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center">
      <h3 className="text-lg font-semibold text-gray-900">{community.name}</h3>
      <p className="text-sm text-gray-500 mt-1">שתף את הקוד הבא עם חברי הקהילה</p>
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mt-5">
        <QRCode value={code} size={180} />
      </div>
      <div className="text-xs text-gray-500 mt-5">קוד הצטרפות</div>
      <div className="text-3xl font-mono font-bold tracking-widest text-blue-900 mt-1" dir="ltr">{formatted}</div>
      <div className="text-xs text-gray-400 mt-1">{deviceCount} מכשירים מחוברים</div>
      <div className="flex gap-2 mt-5 w-full max-w-xs">
        <button onClick={copy} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">
          <Copy size={15} /> העתק קוד
        </button>
        <button onClick={share} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-900 text-white rounded-lg py-2 text-sm hover:bg-blue-800">
          <Share2 size={15} /> שתף
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-4">סרוק את ה-QR או הכנס את הקוד באפליקציה</p>
    </div>
  );
}

// ── Logs tab ─────────────────────────────────────────────────────────────────

function LogsTab({ communityId, devices, logsEnabled }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!logsEnabled) { setLoading(false); return; }
    let alive = true;
    tetherApi.get(`/admin/communities/${communityId}/logs`, { headers: authHeader() })
      .then(({ data }) => { if (alive) setLogs(data || []); })
      .catch(err => { if (alive) setError(err.response?.data?.message || 'שגיאה בטעינת לוגים'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [communityId, logsEnabled]);

  if (!logsEnabled) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ScrollText size={40} className="mx-auto mb-3 opacity-40" />
        <p>הלוגים כבויים לקהילה זו</p>
        <p className="text-xs mt-1">אפשר להפעיל אותם בלשונית "מדיניות" ← מתקדם ← "אפשר לוגים"</p>
      </div>
    );
  }
  if (loading) return <div className="text-center py-12 text-gray-400">טוען...</div>;
  if (error) return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;

  const nameOf = (id) => { const d = devices.find(x => x.deviceId === id); return d ? deviceName(d) : id?.slice(0, 8); };
  const q = filter.trim().toLowerCase();
  const filtered = !q ? logs : logs.filter(l =>
    nameOf(l.deviceId)?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || l.packageName?.toLowerCase().includes(q));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="חיפוש"
          className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">אין לוגים</div>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtered.map(log => (
            <li key={log.id} className="flex items-start gap-3 px-4 py-2.5">
              {log.result === 'blocked'
                ? <Ban size={16} className="text-red-500 mt-0.5 shrink-0" />
                : <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{log.action}</div>
                {log.packageName && <div className="text-xs text-gray-500 font-mono" dir="ltr">{log.packageName}</div>}
                <div className="text-xs text-gray-400">{log.deviceModel || nameOf(log.deviceId)} • {fmtDateTime(log.timestamp)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
