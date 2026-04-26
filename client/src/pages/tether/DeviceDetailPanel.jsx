import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, CheckCircle, XCircle, RefreshCw, Lock, Unlock,
  Settings, Search, Send, MessageSquare, Bell, Trash2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';
import DeviceLockModal from './DeviceLockModal';
import AppTimeLockModal from './AppTimeLockModal';

export default function DeviceDetailPanel({ deviceId, onClose, onNicknameUpdated, onRemoved }) {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nicknameEdit, setNicknameEdit] = useState(false);
  const [nickname, setNickname] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [timeLockTarget, setTimeLockTarget] = useState(null);
  const [showDeviceLock, setShowDeviceLock] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showMsgBox, setShowMsgBox] = useState(false);
  const [localAllowUninstall, setLocalAllowUninstall] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get(`/admin/devices/${deviceId}`, { headers: authHeader() });
      setDevice(data);
      setNickname(data.deviceNickname || '');
      setLocalAllowUninstall(data.allowUninstall ?? false);
    } catch { toast.error('שגיאה בטעינת מכשיר'); }
    finally { setLoading(false); }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const saveNickname = async () => {
    try {
      await tetherApi.put(`/admin/devices/${deviceId}/nickname`, { nickname }, { headers: authHeader() });
      setDevice(d => ({ ...d, deviceNickname: nickname || null }));
      setNicknameEdit(false);
      onNicknameUpdated?.(deviceId, nickname);
      toast.success('שם נשמר');
    } catch { toast.error('שגיאה'); }
  };

  const applyPolicy = async (newPolicy) => {
    setSaving(true);
    try {
      const { data } = await tetherApi.put(`/admin/devices/${deviceId}/device-policy`, newPolicy, { headers: authHeader() });
      setDevice(d => ({ ...d, devicePolicy: data.devicePolicy, mergedPolicy: data.mergedPolicy }));
      toast.success('מדיניות עודכנה');
    } catch { toast.error('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  const patchPolicy = (patch) => applyPolicy({ ...(device.devicePolicy || {}), ...patch });

  const togglePolicyBool = (key) => {
    const cur = device.devicePolicy?.[key] ?? null;
    patchPolicy({ [key]: cur === null ? true : cur === true ? false : null });
  };

  const toggleAppBlock = (pkg, action) => {
    const pol = device.devicePolicy || {};
    let blocked = [...(pol.blockedApps || [])];
    let allowed = [...(pol.allowedApps || [])];
    if (action === 'block')      { if (!blocked.includes(pkg)) blocked.push(pkg); allowed = allowed.filter(a => a !== pkg); }
    else if (action === 'allow') { if (!allowed.includes(pkg)) allowed.push(pkg); blocked = blocked.filter(a => a !== pkg); }
    else                         { blocked = blocked.filter(a => a !== pkg); allowed = allowed.filter(a => a !== pkg); }
    applyPolicy({ ...pol, blockedApps: blocked, allowedApps: allowed });
  };

  const setAppTimeLock = (pkg, tsMs) => {
    setTimeLockTarget(null);
    const pol = device.devicePolicy || {};
    let locks = (pol.appTimeLocks || []).filter(l => l.packageName !== pkg);
    if (tsMs !== -1) locks.push({ packageName: pkg, lockedUntilTs: tsMs });
    applyPolicy({ ...pol, appTimeLocks: locks });
  };

  const lockDevice = (ts) => {
    setShowDeviceLock(false);
    patchPolicy({ lockedUntilTs: ts === 0 ? null : ts });
  };

  const toggleAllowUninstall = async () => {
    const next = !localAllowUninstall;
    try {
      await tetherApi.put(`/admin/devices/${deviceId}/allow-uninstall`, { allowUninstall: next }, { headers: authHeader() });
      setLocalAllowUninstall(next);
      setDevice(d => ({ ...d, allowUninstall: next }));
      toast.success(next ? 'מחיקה אושרה — המשתמש יכול למחוק' : 'מחיקה נחסמה');
    } catch { toast.error('שגיאה'); }
  };

  const removeDevice = async () => {
    if (!confirm('להסיר מכשיר זה מהקהילה לצמיתות?')) return;
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
      const labels = { FORCE_SYNC: 'בקשת סנכרון נשלחה', RELEASE_ALL: 'שחרור נשלח', SHOW_MESSAGE: 'הודעה נשלחה' };
      toast.success(labels[type] || 'פקודה נשלחה');
    } catch { toast.error('שגיאה בשליחת פקודה'); }
  };

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    setSendingMsg(true);
    await sendCommand('SHOW_MESSAGE', msgText.trim());
    setMsgText(''); setShowMsgBox(false); setSendingMsg(false);
  };

  const isOnline = device?.lastSeen && (Date.now() - new Date(device.lastSeen)) < 30 * 60_000;
  const pol = device?.devicePolicy || {};
  const blockedApps   = pol.blockedApps   || [];
  const allowedApps   = pol.allowedApps   || [];
  const appTimeLocks  = pol.appTimeLocks  || [];
  const deviceLockedUntil = pol.lockedUntilTs ?? null;
  const deviceIsLocked = deviceLockedUntil && deviceLockedUntil > Date.now();

  const filteredApps = (device?.installedApps || []).filter(a =>
    !appSearch ||
    a.appName?.toLowerCase().includes(appSearch.toLowerCase()) ||
    a.packageName?.toLowerCase().includes(appSearch.toLowerCase())
  );

  const boolChip = (key) => {
    const v = pol[key] ?? null;
    if (v === null) return { label: 'קהילה', cls: 'bg-gray-100 text-gray-600' };
    if (v)          return { label: 'חסום',   cls: 'bg-red-100 text-red-700' };
    return                { label: 'מותר',   cls: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="bg-gray-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">

        {/* Sticky header */}
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded"><XCircle size={18} /></button>
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
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0 ${isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isOnline ? 'מחובר' : 'לא מחובר'}
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1"><RefreshCw size={15} /></button>
        </div>

        {loading ? <div className="py-20 text-center text-gray-400">טוען...</div> : !device ? null : (
          <div className="p-4 space-y-4">

            {/* Device lock banner */}
            {deviceIsLocked && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700">
                  <Lock size={14} />
                  <span className="text-sm font-medium">מכשיר נעול עד {new Date(deviceLockedUntil).toLocaleString('he-IL')}</span>
                </div>
                <button onClick={() => lockDevice(0)} className="text-xs bg-red-700 text-white px-2 py-1 rounded hover:bg-red-800">בטל נעילה</button>
              </div>
            )}

            {/* Meta */}
            <div className="bg-white rounded-xl p-4 text-sm text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>קהילה:</span><span className="font-medium text-gray-800">{device.communityName}</span></div>
              <div className="flex justify-between"><span>מזהה:</span><span className="font-mono text-xs text-gray-500 truncate max-w-[60%]">{device.deviceId}</span></div>
              <div className="flex justify-between"><span>נראה לאחרונה:</span><span>{timeAgo(device.lastSeen)}</span></div>
              <div className="flex justify-between"><span>הצטרף:</span><span>{new Date(device.createdAt).toLocaleDateString('he-IL')}</span></div>
            </div>

            {/* Protection status */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">מצב הגנה</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'accessibilityEnabled', label: 'נגישות' },
                  { key: 'isDeviceAdmin',         label: 'מנהל מכשיר' },
                  { key: 'isDeviceOwner',         label: 'בעלים (DO)' },
                  { key: 'vpnActive',             label: 'VPN פעיל' },
                ].map(s => {
                  const ok = device.protectionStatus?.[s.key];
                  return (
                    <div key={s.key} className={`flex items-center gap-2 rounded-lg p-2.5 ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                      {ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      <span className="text-xs font-medium">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {device.protectionStatus?.lastHeartbeat && (
                <p className="text-xs text-gray-400 mt-2">דופק אחרון: {timeAgo(device.protectionStatus.lastHeartbeat)}</p>
              )}
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">פעולות מהירות</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setShowMsgBox(!showMsgBox)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition">
                  <MessageSquare size={13} /> שלח הודעה
                </button>
                <button onClick={() => sendCommand('FORCE_SYNC')}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                  <RefreshCw size={13} /> סנכרן עכשיו
                </button>
                <button onClick={() => setShowDeviceLock(true)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${deviceIsLocked ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
                  <Lock size={13} /> {deviceIsLocked ? 'נעול' : 'נעל מכשיר'}
                </button>
              </div>

              {showMsgBox && (
                <div className="flex gap-2 mb-3">
                  <input value={msgText} onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="הודעה לשלוח למכשיר..."
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={sendMessage} disabled={sendingMsg}
                    className="bg-blue-900 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-60">
                    <Send size={14} />
                  </button>
                </div>
              )}

              {/* Allow uninstall toggle */}
              <div className="flex items-center justify-between py-2.5 border-t border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-700">אפשר מחיקת אפליקציה</div>
                  <div className="text-xs text-gray-400">כשמופעל — המשתמש יכול להסיר את Tether</div>
                </div>
                <button onClick={toggleAllowUninstall}
                  className={`relative w-10 h-5 rounded-full transition-colors ${localAllowUninstall ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${localAllowUninstall ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Release all */}
              <div className="pt-2 border-t border-gray-100">
                <button onClick={() => { if (confirm('לשחרר את כל ההגנות ולשלוח פקודת מחיקה למכשיר?')) sendCommand('RELEASE_ALL'); }}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition w-full justify-center">
                  <Unlock size={13} /> שחרר הכל ומחק אפליקציה
                </button>
              </div>
            </div>

            {/* Store & install blocking */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-1 text-sm">חסימת חנויות והתקנות</h3>
              <p className="text-xs text-gray-400 mb-3">לחץ לעבור: קהילה (אפור) ← חסום (אדום) ← מותר (ירוק)</p>
              {[
                { key: 'blockInstallApps', label: 'חסום התקנת אפליקציות' },
                { key: 'blockAllStores',   label: 'חסום כל חנויות אפליקציות' },
                { key: 'blockApkInstall',  label: 'חסום APK ישיר (sideload)' },
                { key: 'hideGooglePlay',   label: 'הסתר / חסום Google Play' },
              ].map(({ key, label }) => {
                const { label: sl, cls } = boolChip(key);
                return (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button onClick={() => togglePolicyBool(key)} disabled={saving}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition disabled:opacity-50 ${cls}`}>
                      {sl}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Installed apps */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">
                אפליקציות מותקנות ({device.installedApps?.length ?? 0})
              </h3>
              <div className="relative mb-3">
                <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={appSearch} onChange={e => setAppSearch(e.target.value)}
                  placeholder="חפש שם אפליקציה או package..."
                  className="w-full border rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {(device.installedApps?.length ?? 0) === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">המכשיר עדיין לא דיווח רשימת אפליקציות</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {filteredApps.map(app => {
                    const isBlocked   = blockedApps.includes(app.packageName);
                    const isAllowed   = allowedApps.includes(app.packageName);
                    const timeLock    = appTimeLocks.find(l => l.packageName === app.packageName);
                    const isTimeLocked = timeLock && (timeLock.lockedUntilTs === null || timeLock.lockedUntilTs > Date.now());
                    return (
                      <li key={app.packageName}
                        className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isBlocked ? 'bg-red-50' : isTimeLocked ? 'bg-orange-50' : isAllowed ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{app.appName}</div>
                          <div className="text-gray-400 truncate">{app.packageName}</div>
                        </div>
                        {timeLock && (
                          <span title={timeLock.lockedUntilTs ? `נעול עד ${new Date(timeLock.lockedUntilTs).toLocaleString('he-IL')}` : 'חסום קבוע'}
                            className="text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded shrink-0 font-medium">
                            {timeLock.lockedUntilTs === null ? '∞' : '⏱'}
                          </span>
                        )}
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => toggleAppBlock(app.packageName, isAllowed ? 'reset' : 'allow')} title="אפשר תמיד"
                            className={`px-2 py-1 rounded transition ${isAllowed ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 hover:bg-green-50 text-gray-500 hover:text-green-700'}`}>✓</button>
                          <button onClick={() => toggleAppBlock(app.packageName, isBlocked ? 'reset' : 'block')} title="חסום תמיד"
                            className={`px-2 py-1 rounded transition ${isBlocked ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-700'}`}>✕</button>
                          <button onClick={() => setTimeLockTarget(app)} title="נעל לפי זמן"
                            className={`px-2 py-1 rounded transition ${isTimeLocked ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 hover:bg-orange-50 text-gray-500 hover:text-orange-600'}`}>
                            <Clock size={11} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Security events */}
            {(device.securityEvents?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                  <Bell size={13} className="text-orange-500" /> אירועי אבטחה ({device.securityEvents.length})
                </h3>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {[...device.securityEvents].reverse().map((ev, i) => (
                    <li key={i} className="flex items-center justify-between text-xs bg-orange-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-medium text-orange-800">{ev.type}</span>
                        {ev.packageName && <span className="text-orange-600 mr-1"> · {ev.packageName}</span>}
                      </div>
                      <span className="text-gray-400 shrink-0">{timeAgo(ev.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Danger zone */}
            <div className="bg-white rounded-xl p-4 border border-red-100">
              <h3 className="font-semibold text-red-700 mb-3 text-sm">אזור מסוכן</h3>
              <button onClick={removeDevice}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition w-full justify-center">
                <Trash2 size={13} /> הסר מכשיר מהמערכת
              </button>
            </div>

          </div>
        )}

        {timeLockTarget && (
          <AppTimeLockModal
            app={timeLockTarget}
            currentLock={appTimeLocks.find(l => l.packageName === timeLockTarget.packageName)}
            onSave={setAppTimeLock}
            onClose={() => setTimeLockTarget(null)}
          />
        )}

        {showDeviceLock && (
          <DeviceLockModal
            currentLockTs={deviceLockedUntil}
            onSave={lockDevice}
            onClose={() => setShowDeviceLock(false)}
          />
        )}
      </div>
    </div>
  );
}
