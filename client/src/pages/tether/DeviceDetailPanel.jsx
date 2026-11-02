// Device side panel — web port of the Android admin app's DeviceDetailScreen: a status header
// with quick actions, then tabs for installed apps, per-device settings and security events.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, XCircle, RefreshCw, Lock, LockOpen, Search, Send, MessageSquare, Trash2,
  AppWindow, SlidersHorizontal, ShieldAlert, Ban, AlertTriangle, UserCog, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';
import DeviceLockModal from './DeviceLockModal';
import AppTimeLockModal from './AppTimeLockModal';
import DevicePolicyTab from './DevicePolicyTab';
import { ProtectionChips, OnlineBadge, Switch, ConfirmDialog, AppIcon, fmtDateTime, isOnlineNow } from './ui';
import { blockedElsewhereReason, displayName } from './blockPackCatalog';

const TABS = [
  { id: 'apps', label: 'אפליקציות', icon: AppWindow },
  { id: 'settings', label: 'הגדרות אישיות', icon: SlidersHorizontal },
  { id: 'events', label: 'אירועים', icon: ShieldAlert },
];

const EVENT_LABELS = {
  UNINSTALL_ATTEMPT: { label: 'ניסיון הסרת אפליקציה', icon: Trash2 },
  ADMIN_DEACTIVATE_ATTEMPT: { label: 'ניסיון ביטול הרשאות מנהל', icon: UserCog },
  BLOCKED_APP_OPENED: { label: 'ניסיון פתיחת אפליקציה חסומה', icon: Ban },
  TIME_LOCK_BLOCKED: { label: 'חסימת זמן פעלה', icon: Lock },
};

const COMMAND_TOASTS = { FORCE_SYNC: 'סנכרון נשלח', RELEASE_ALL: 'שחרור מלא נשלח', SHOW_MESSAGE: 'הודעה נשלחה' };

export default function DeviceDetailPanel({ deviceId, onClose, onNicknameUpdated, onRemoved }) {
  const [device, setDevice] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('apps');
  const [nicknameEdit, setNicknameEdit] = useState(false);
  const [nickname, setNickname] = useState('');
  const [showDeviceLock, setShowDeviceLock] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [showMsgBox, setShowMsgBox] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'remove' | 'release' | 'uninstall'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, evRes] = await Promise.all([
        tetherApi.get(`/admin/devices/${deviceId}`, { headers: authHeader() }),
        tetherApi.get(`/admin/devices/${deviceId}/events`, { headers: authHeader() }).catch(() => null),
      ]);
      setDevice(data);
      setNickname(data.deviceNickname || '');
      // The events endpoint is newest-first; fall back to the detail payload (oldest-first).
      setEvents(evRes?.data?.events ?? [...(data.securityEvents || [])].reverse());
    } catch { toast.error('שגיאה בטעינת מכשיר'); }
    finally { setLoading(false); }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const saveNickname = async () => {
    const next = nickname.trim() || null;
    try {
      await tetherApi.put(`/admin/devices/${deviceId}/nickname`, { nickname: next }, { headers: authHeader() });
      setDevice(d => ({ ...d, deviceNickname: next }));
      setNicknameEdit(false);
      onNicknameUpdated?.(deviceId, next);
      toast.success('שם עודכן');
    } catch { toast.error('שגיאה'); }
  };

  const applyPolicy = async (newPolicy, successMsg = 'הגדרות המכשיר נשמרו ✓') => {
    setSaving(true);
    try {
      const { data } = await tetherApi.put(`/admin/devices/${deviceId}/device-policy`, newPolicy, { headers: authHeader() });
      setDevice(d => ({ ...d, devicePolicy: data.devicePolicy, mergedPolicy: data.mergedPolicy }));
      toast.success(successMsg);
      return true;
    } catch {
      toast.error('שגיאה בשמירה');
      return false;
    } finally { setSaving(false); }
  };

  const patchPolicy = (patch) => applyPolicy({ ...(device.devicePolicy || {}), ...patch }, 'מדיניות עודכנה');

  const toggleAppBlock = (pkg, action) => {
    const pol = device.devicePolicy || {};
    let blocked = [...(pol.blockedApps || [])];
    let allowed = [...(pol.allowedApps || [])];
    if (action === 'block')      { if (!blocked.includes(pkg)) blocked.push(pkg); allowed = allowed.filter(a => a !== pkg); }
    else if (action === 'allow') { if (!allowed.includes(pkg)) allowed.push(pkg); blocked = blocked.filter(a => a !== pkg); }
    else                         { blocked = blocked.filter(a => a !== pkg); allowed = allowed.filter(a => a !== pkg); }
    applyPolicy({ ...pol, blockedApps: blocked, allowedApps: allowed }, 'מדיניות עודכנה');
  };

  const setAppTimeLock = (pkg, tsMs) => {
    const pol = device.devicePolicy || {};
    const locks = (pol.appTimeLocks || []).filter(l => l.packageName !== pkg);
    if (tsMs !== -1) locks.push({ packageName: pkg, lockedUntilTs: tsMs });
    applyPolicy({ ...pol, appTimeLocks: locks }, 'מדיניות עודכנה');
  };

  const lockDevice = (ts) => {
    setShowDeviceLock(false);
    patchPolicy({ lockedUntilTs: ts === 0 ? null : ts });
  };

  const setAllowUninstall = async (next) => {
    try {
      await tetherApi.put(`/admin/devices/${deviceId}/allow-uninstall`, { allowUninstall: next }, { headers: authHeader() });
      setDevice(d => ({ ...d, allowUninstall: next }));
      toast.success(next ? 'מחיקה אושרה — המשתמש יכול למחוק' : 'מחיקה נחסמה');
    } catch { toast.error('שגיאה'); }
  };

  const removeDevice = async () => {
    try {
      await tetherApi.delete(`/admin/devices/${deviceId}`, { headers: authHeader() });
      toast.success('מכשיר הוסר');
      onRemoved?.(deviceId);
      onClose();
    } catch { toast.error('שגיאה בהסרה'); }
  };

  const sendCommand = async (type, payload = '') => {
    try {
      await tetherApi.post(`/admin/devices/${deviceId}/commands`, { type, payload }, { headers: authHeader() });
      toast.success(COMMAND_TOASTS[type] || 'פקודה נשלחה');
    } catch { toast.error('שגיאה בשליחת פקודה'); }
  };

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    await sendCommand('SHOW_MESSAGE', msgText.trim());
    setMsgText(''); setShowMsgBox(false);
  };

  const installedPackages = useMemo(
    () => new Set((device?.installedApps || []).map(a => a.packageName)), [device?.installedApps]);

  const online = isOnlineNow(device?.lastSeen);
  const deviceLockedUntil = device?.devicePolicy?.lockedUntilTs ?? null;
  const deviceIsLocked = deviceLockedUntil && deviceLockedUntil > Date.now();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="bg-gray-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">

        {/* Sticky header */}
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={onClose} aria-label="סגור" className="text-gray-400 hover:text-gray-600 p-1 rounded"><XCircle size={18} /></button>
          <div className="flex-1 min-w-0">
            {nicknameEdit ? (
              <div className="flex items-center gap-2">
                <input value={nickname} onChange={e => setNickname(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveNickname()}
                  className="border rounded px-2 py-0.5 text-sm font-medium flex-1" placeholder="כינוי למכשיר" autoFocus />
                <button onClick={saveNickname} className="text-blue-600 text-xs font-medium">שמור</button>
                <button onClick={() => setNicknameEdit(false)} className="text-gray-400 text-xs">ביטול</button>
              </div>
            ) : (
              <button onClick={() => setNicknameEdit(true)} className="text-right w-full group">
                <div className="font-semibold text-gray-900 truncate">
                  {device?.deviceNickname || device?.deviceModel || '...'}
                  <span className="text-gray-300 text-xs mr-1.5 opacity-0 group-hover:opacity-100">✎</span>
                </div>
                {device?.deviceNickname && <div className="text-xs text-gray-500 truncate">{device.deviceModel}</div>}
              </button>
            )}
          </div>
          <OnlineBadge online={online} />
          <button onClick={load} aria-label="רענן" className="text-gray-400 hover:text-gray-600 p-1"><RefreshCw size={15} /></button>
        </div>

        {loading ? <div className="py-20 text-center text-gray-400">טוען...</div> : !device ? null : (
          <div className="p-4 space-y-4">

            {deviceIsLocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700">
                  <Lock size={14} />
                  <span className="text-sm font-medium">מכשיר נעול עד {fmtDateTime(deviceLockedUntil)}</span>
                </div>
                <button onClick={() => lockDevice(0)} className="text-xs bg-red-700 text-white px-2 py-1 rounded hover:bg-red-800">בטל נעילה</button>
              </div>
            )}

            {/* Status + quick actions (the app's DeviceStatusHeader) */}
            <div className="bg-white rounded-xl p-4 space-y-3">
              <ProtectionChips status={device.protectionStatus} isDeviceOwner={device.isDeviceOwner} />
              <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-1">
                <span>קהילה: <span className="text-gray-800 font-medium">{device.communityName}</span></span>
                <span>נראה לאחרונה: {timeAgo(device.lastSeen)}</span>
                <span>הצטרף: {new Date(device.createdAt).toLocaleDateString('he-IL')}</span>
                {device.protectionStatus?.lastHeartbeat && <span>דופק אחרון: {timeAgo(device.protectionStatus.lastHeartbeat)}</span>}
                <span className="col-span-2 font-mono truncate" dir="ltr">{device.deviceId}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => sendCommand('FORCE_SYNC')}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  <RefreshCw size={13} /> סנכרן
                </button>
                <button onClick={() => setShowMsgBox(!showMsgBox)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100">
                  <MessageSquare size={13} /> הודעה
                </button>
                <button onClick={() => setShowDeviceLock(true)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${deviceIsLocked ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
                  <Lock size={13} /> {deviceIsLocked ? 'נעול' : 'נעל מכשיר'}
                </button>
                <button onClick={() => setConfirm('release')}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
                  <LockOpen size={13} /> שחרר ומחק
                </button>
                <div className="flex-1" />
                <span className="text-xs text-gray-500">הסר-התקנה</span>
                <Switch checked={!!device.allowUninstall} danger label="אפשר הסרת התקנה"
                  onChange={next => (next ? setConfirm('uninstall') : setAllowUninstall(false))} />
              </div>

              {showMsgBox && (
                <div className="flex gap-2">
                  <input value={msgText} onChange={e => setMsgText(e.target.value)} autoFocus
                    onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="הודעה לשלוח למכשיר..."
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={sendMessage} disabled={!msgText.trim()} aria-label="שלח"
                    className="bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-60"><Send size={14} /></button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-200/70 rounded-xl p-1" role="tablist">
              {TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition ${
                    tab === t.id ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <t.icon size={14} /> {t.label}
                  {t.id === 'events' && events.length > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 rounded-full px-1.5">{events.length}</span>}
                </button>
              ))}
            </div>

            {tab === 'apps' && (
              <AppsTab device={device} saving={saving} onToggle={toggleAppBlock} onTimeLock={setAppTimeLock} />
            )}
            {tab === 'settings' && (
              <DevicePolicyTab key={JSON.stringify(device.devicePolicy || {})}
                policy={device.devicePolicy || {}} mergedPolicy={device.mergedPolicy}
                installedPackages={installedPackages} saving={saving} onSave={applyPolicy} />
            )}
            {tab === 'events' && <EventsTab events={events} />}

            {/* Danger zone */}
            <div className="bg-white rounded-xl p-4 border border-red-100">
              <h3 className="font-semibold text-red-700 mb-3 text-sm">אזור מסוכן</h3>
              <button onClick={() => setConfirm('remove')}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition w-full justify-center">
                <Trash2 size={13} /> הסר מכשיר מהמערכת
              </button>
            </div>
          </div>
        )}

        {showDeviceLock && (
          <DeviceLockModal currentLockTs={deviceLockedUntil} onSave={lockDevice} onClose={() => setShowDeviceLock(false)} />
        )}
        {confirm === 'remove' && (
          <ConfirmDialog title="הסר מכשיר" confirmLabel="הסר"
            text={`להסיר את "${device?.deviceNickname || device?.deviceModel}"? המכשיר יאבד את ההגנה.`}
            onConfirm={() => { setConfirm(null); removeDevice(); }} onCancel={() => setConfirm(null)} />
        )}
        {confirm === 'release' && (
          <ConfirmDialog title="שחרר ומחק" icon={LockOpen} confirmLabel="שחרר"
            text="פעולה זו תסיר את כל ההגנות ותפתח אפשרות מחיקה. לא ניתן לבטל."
            onConfirm={() => { setConfirm(null); sendCommand('RELEASE_ALL'); }} onCancel={() => setConfirm(null)} />
        )}
        {confirm === 'uninstall' && (
          <ConfirmDialog title="אפשר הסרת אפליקציה?" confirmLabel="אשר"
            text="פעולה זו תאפשר למשתמש להסיר את Tether מהמכשיר. הגנות יבוטלו תוך דקה."
            onConfirm={() => { setConfirm(null); setAllowUninstall(true); }} onCancel={() => setConfirm(null)} />
        )}
      </div>
    </div>
  );
}

// ── Apps tab ─────────────────────────────────────────────────────────────────

function AppsTab({ device, saving, onToggle, onTimeLock }) {
  const [search, setSearch] = useState('');
  const [timeLockTarget, setTimeLockTarget] = useState(null);
  const pol = device.devicePolicy || {};
  const blockedApps = pol.blockedApps || [];
  const allowedApps = pol.allowedApps || [];
  const appTimeLocks = pol.appTimeLocks || [];

  const apps = useMemo(
    () => [...(device.installedApps || [])].sort((a, b) => displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase())),
    [device.installedApps]);
  const q = search.trim().toLowerCase();
  const filtered = !q ? apps : apps.filter(a => displayName(a).toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q));

  if (apps.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-400">
        <AppWindow size={36} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">אין נתוני אפליקציות ברשימה שהגיעה מהשרת</p>
        <p className="text-xs mt-1">נא לבצע סנכרון במכשיר היעד</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4">
      <div className="relative mb-2">
        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חפש אפליקציה..."
          className="w-full border rounded-lg pr-8 pl-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {search && <button onClick={() => setSearch('')} aria-label="נקה חיפוש" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
      </div>
      <p className="text-xs text-gray-500 mb-2">{filtered.length} אפליקציות · ✓ אפשר תמיד · ✕ חסום · <Clock size={10} className="inline" /> נעילה לפי זמן</p>

      <ul className="space-y-1.5">
        {filtered.map(app => {
          const name = displayName(app);
          const isBlocked = blockedApps.includes(app.packageName);
          const isAllowed = allowedApps.includes(app.packageName);
          const elsewhere = isBlocked ? null : blockedElsewhereReason(app.packageName, device.mergedPolicy);
          const timeLock = appTimeLocks.find(l => l.packageName === app.packageName);
          const isTimeLocked = timeLock && (timeLock.lockedUntilTs == null || timeLock.lockedUntilTs > Date.now());
          const status = elsewhere
            || (isBlocked && 'חסום במכשיר הזה')
            || (isTimeLocked && (timeLock.lockedUntilTs == null ? 'נעול לצמיתות' : `נעול עד ${fmtDateTime(timeLock.lockedUntilTs)}`))
            || (isAllowed && 'מותר תמיד במכשיר הזה');
          const tone = isBlocked || elsewhere ? 'bg-red-50' : isTimeLocked ? 'bg-orange-50' : isAllowed ? 'bg-green-50' : 'bg-gray-50';

          return (
            <li key={app.packageName} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${tone}`}>
              <AppIcon packageName={app.packageName} label={name} iconHash={app.iconHash} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                {status
                  ? <div className={`text-xs truncate ${isBlocked || elsewhere ? 'text-red-600' : isTimeLocked ? 'text-orange-600' : 'text-green-700'}`}>{status}</div>
                  : <div className="text-[11px] text-gray-400 truncate" dir="ltr">{app.packageName}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onToggle(app.packageName, isAllowed ? 'reset' : 'allow')} disabled={saving} title="אפשר תמיד" aria-label={`אפשר תמיד את ${name}`}
                  className={`px-2 py-1 rounded text-xs transition disabled:opacity-50 ${isAllowed ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 hover:bg-green-50 text-gray-500 hover:text-green-700'}`}>✓</button>
                <button onClick={() => onToggle(app.packageName, isBlocked ? 'reset' : 'block')}
                  // Blocked by the community or a whole-category switch: a device toggle would not
                  // release it, so it is shown on but locked.
                  disabled={saving || !!elsewhere} title={elsewhere || 'חסום במכשיר הזה'} aria-label={`חסום את ${name}`}
                  className={`px-2 py-1 rounded text-xs transition disabled:cursor-not-allowed ${
                    isBlocked || elsewhere ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-700'} ${elsewhere ? 'opacity-60' : ''}`}>✕</button>
                <button onClick={() => setTimeLockTarget({ ...app, appName: name })} disabled={saving} title="נעל לפי זמן" aria-label={`נעל לפי זמן את ${name}`}
                  className={`px-2 py-1 rounded transition disabled:opacity-50 ${isTimeLocked ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 hover:bg-orange-50 text-gray-500 hover:text-orange-600'}`}>
                  <Clock size={11} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {timeLockTarget && (
        <AppTimeLockModal app={timeLockTarget}
          currentLock={appTimeLocks.find(l => l.packageName === timeLockTarget.packageName)}
          onSave={(pkg, ts) => { setTimeLockTarget(null); onTimeLock(pkg, ts); }}
          onClose={() => setTimeLockTarget(null)} />
      )}
    </div>
  );
}

// ── Events tab ───────────────────────────────────────────────────────────────

function EventsTab({ events }) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-400">
        <ShieldAlert size={36} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">אין אירועי אבטחה</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2">{events.length} אירועים (חדשים ראשונים)</p>
      <ul className="space-y-1.5">
        {events.map((ev, i) => {
          const meta = EVENT_LABELS[ev.type] || { label: ev.type, icon: AlertTriangle };
          return (
            <li key={i} className="flex items-center gap-2.5 bg-red-50/70 rounded-lg px-3 py-2">
              <meta.icon size={16} className="text-red-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{meta.label}</div>
                {ev.packageName && <div className="text-xs text-gray-500 font-mono truncate" dir="ltr">{ev.packageName}</div>}
              </div>
              <span className="text-xs text-gray-400 shrink-0" title={fmtDateTime(ev.timestamp)}>{timeAgo(ev.timestamp)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
