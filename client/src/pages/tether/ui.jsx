// Shared building blocks for the Tether admin screens — web counterparts of the Android admin
// app's policy primitives (PolicySectionCard, PolicyRow, NullablePolicyRow, AppListSection, …).
import React, { useEffect, useState } from 'react';
import { X, Plus, Lock, Clock, Globe, Check, Save, Package } from 'lucide-react';
import { tetherApi, authHeader } from './tetherApi';

// ── helpers ──────────────────────────────────────────────────────────────────

/** ms timestamp → value for <input type="datetime-local"> (local time). */
export const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Same 30-minute window the server uses for `isOnline`. */
export const isOnlineNow = (lastSeen) => !!lastSeen && (Date.now() - new Date(lastSeen)) < 30 * 60_000;

export const deviceName = (d) => d?.deviceNickname || d?.deviceModel || 'מכשיר';

// ── basic controls ───────────────────────────────────────────────────────────

export function Switch({ checked, onChange, disabled, danger, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative w-10 h-5 rounded-full transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? (danger ? 'bg-red-500' : 'bg-blue-600') : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

export function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 ${className}`}>
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
        {Icon && <Icon size={17} className="text-gray-500" />}
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ToggleRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">{label}</div>
        {desc && <div className="text-xs text-gray-500">{desc}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

/** A device override: null = follow the community. */
export function TriStateSelect({ value, onChange, disabled, labels = ['לפי הקהילה', 'מופעל', 'כבוי'], ariaLabel }) {
  const encoded = value == null ? 'inherit' : value ? 'on' : 'off';
  return (
    <select value={encoded} disabled={disabled} aria-label={ariaLabel}
      onChange={e => onChange({ inherit: null, on: true, off: false }[e.target.value])}
      className={`border rounded-lg px-2 py-1 text-xs bg-white disabled:opacity-50 ${
        value == null ? 'border-gray-200 text-gray-500' : value ? 'border-red-200 text-red-700' : 'border-green-200 text-green-700'}`}>
      <option value="inherit">{labels[0]}</option>
      <option value="on">{labels[1]}</option>
      <option value="off">{labels[2]}</option>
    </select>
  );
}

export function NullableToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">{label}</div>
        {desc && <div className="text-xs text-gray-500">{desc}</div>}
      </div>
      <TriStateSelect value={value} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

export function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            value === o.value ? 'bg-blue-900 text-white border-blue-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RadioCard({ title, desc, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-right flex items-start gap-3 rounded-xl border p-3 transition ${
        selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${selected ? 'border-blue-700 bg-blue-700 ring-2 ring-inset ring-white' : 'border-gray-300'}`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{title}</span>
        {desc && <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>}
      </span>
    </button>
  );
}

export function RadioRow({ label, desc, selected, onClick }) {
  return (
    <label className="flex items-start gap-2 py-1.5 cursor-pointer">
      <input type="radio" checked={selected} onChange={onClick} className="mt-1 accent-blue-700" />
      <span>
        <span className="block text-sm text-gray-800">{label}</span>
        {desc && <span className="block text-xs text-gray-500">{desc}</span>}
      </span>
    </label>
  );
}

// ── list editors ─────────────────────────────────────────────────────────────

function AddInput({ placeholder, onAdd, normalize = (v) => v.trim() }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = normalize(input);
    if (v && onAdd(v) !== false) setInput('');
  };
  return (
    <div className="flex gap-2">
      <input value={input} onChange={e => setInput(e.target.value)} dir="ltr" placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" onClick={add} aria-label="הוסף"
        className="px-2.5 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100"><Plus size={16} /></button>
    </div>
  );
}

export function PackageListEditor({ title, desc, icon: Icon = Package, apps, onChange, labelOf }) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-2">
        <Icon size={15} className="text-blue-700 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-gray-800">{title}</div>
          {desc && <div className="text-xs text-gray-500">{desc}</div>}
        </div>
      </div>
      <AddInput placeholder="com.example.app" onAdd={pkg => (apps.includes(pkg) ? false : onChange([...apps, pkg]))} />
      {apps.length > 0 && (
        <ul className="mt-2 space-y-1">
          {apps.map(pkg => {
            const label = labelOf?.(pkg);
            return (
              <li key={pkg} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                <AppIcon packageName={pkg} label={label || pkg} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 truncate">{label || pkg}</div>
                  {label && <div className="text-[11px] text-gray-400 truncate" dir="ltr">{pkg}</div>}
                </div>
                <button type="button" onClick={() => onChange(apps.filter(a => a !== pkg))} aria-label={`הסר ${pkg}`}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DomainListEditor({ title, domains, onChange }) {
  return (
    <div className="mt-2">
      <div className="text-sm font-medium text-blue-800 mb-1.5">{title}</div>
      <AddInput placeholder="youtube.com" normalize={v => v.trim().toLowerCase()}
        onAdd={d => (domains.includes(d) ? false : onChange([...domains, d]))} />
      {domains.length > 0 && (
        <ul className="mt-2 space-y-1">
          {domains.map(d => (
            <li key={d} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-gray-50">
              <Globe size={13} className="text-gray-400" />
              <span className="flex-1 font-mono text-gray-700" dir="ltr">{d}</span>
              <button type="button" onClick={() => onChange(domains.filter(x => x !== d))} aria-label={`הסר ${d}`}
                className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Lock everything until…" — the app's TimeLockSection (date + time picker). */
export function DeviceLockField({ lockedUntilTs, onChange, lockedPrefix, lockLabel, changeLabel }) {
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState('');
  const isLocked = lockedUntilTs != null && lockedUntilTs > Date.now();

  const open = () => {
    setValue(toLocalInput(lockedUntilTs || Date.now() + 60 * 60_000));
    setPicking(true);
  };
  const apply = () => {
    const ts = fromLocalInput(value);
    if (ts) onChange(ts);
    setPicking(false);
  };

  return (
    <div className="space-y-2">
      {isLocked && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2">
          <Lock size={15} />
          <span className="flex-1 text-sm font-medium">{lockedPrefix} {fmtDateTime(lockedUntilTs)}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="בטל נעילה" className="p-1 hover:bg-red-100 rounded"><X size={14} /></button>
        </div>
      )}
      {picking ? (
        <div className="flex gap-2">
          <input type="datetime-local" value={value} min={toLocalInput(Date.now())} onChange={e => setValue(e.target.value)}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
          <button type="button" onClick={apply} className="px-3 rounded-lg bg-blue-900 text-white text-sm">אישור</button>
          <button type="button" onClick={() => setPicking(false)} className="px-2 text-sm text-gray-500">ביטול</button>
        </div>
      ) : (
        <button type="button" onClick={open}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
          <Clock size={15} /> {isLocked ? changeLabel : lockLabel}
        </button>
      )}
    </div>
  );
}

/** Per-app time locks: add a package (permanent), then optionally set a release date. */
export function AppTimeLocksEditor({ locks, onChange, hint }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');

  const startEdit = (lock) => {
    setEditing(lock.packageName);
    setValue(toLocalInput(lock.lockedUntilTs || Date.now() + 60 * 60_000));
  };
  const applyEdit = () => {
    const ts = fromLocalInput(value);
    if (ts) onChange(locks.map(l => (l.packageName === editing ? { ...l, lockedUntilTs: ts } : l)));
    setEditing(null);
  };

  return (
    <div>
      <div className="text-sm font-medium text-blue-800">נעילת אפליקציות ספציפיות</div>
      {hint && <div className="text-xs text-gray-500 mb-1.5">{hint}</div>}
      <div className="mt-1.5">
        <AddInput placeholder="com.example.app"
          onAdd={pkg => (locks.some(l => l.packageName === pkg) ? false : onChange([...locks, { packageName: pkg, lockedUntilTs: null }]))} />
      </div>
      <ul className="mt-2 space-y-1">
        {locks.map(lock => (
          <li key={lock.packageName} className="bg-gray-50 rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Lock size={13} className="text-red-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 truncate font-mono" dir="ltr">{lock.packageName}</div>
                <div className="text-xs text-gray-500">
                  {lock.lockedUntilTs == null ? 'חסום לצמיתות' : `חסום עד: ${fmtDateTime(lock.lockedUntilTs)}`}
                </div>
              </div>
              <button type="button" onClick={() => startEdit(lock)} title="קבע שחרור" aria-label="קבע שחרור"
                className="p-1 text-blue-700 hover:bg-blue-50 rounded"><Clock size={14} /></button>
              <button type="button" onClick={() => onChange(locks.filter(l => l.packageName !== lock.packageName))} aria-label="הסר"
                className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
            </div>
            {editing === lock.packageName && (
              <div className="flex gap-2 mt-2">
                <input type="datetime-local" value={value} onChange={e => setValue(e.target.value)}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <button type="button" onClick={applyEdit} className="px-3 rounded-lg bg-blue-900 text-white text-xs">אישור</button>
                <button type="button" onClick={() => { onChange(locks.map(l => (l.packageName === editing ? { ...l, lockedUntilTs: null } : l))); setEditing(null); }}
                  className="px-2 text-xs text-gray-600">לצמיתות</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── dialogs ──────────────────────────────────────────────────────────────────

export function Modal({ title, icon: Icon, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-white rounded-xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} max-h-[90vh] overflow-y-auto p-5`}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">{Icon && <Icon size={18} />}{title}</h3>
        {children}
        {footer && <div className="flex gap-2 justify-end mt-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel, danger = true, onConfirm, onCancel, icon }) {
  return (
    <Modal title={title} icon={icon} onClose={onCancel}
      footer={<>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">ביטול</button>
        <button type="button" onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-900 hover:bg-blue-800'}`}>{confirmLabel}</button>
      </>}>
      <p className="text-sm text-gray-600">{text}</p>
    </Modal>
  );
}

export function SendMessageDialog({ deviceLabel, onSend, onCancel }) {
  const [msg, setMsg] = useState('');
  return (
    <Modal title="שלח הודעה" onClose={onCancel}
      footer={<>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">ביטול</button>
        <button type="button" disabled={!msg.trim()} onClick={() => onSend(msg.trim())}
          className="px-4 py-2 rounded-lg text-sm text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50">שלח</button>
      </>}>
      {deviceLabel && <p className="text-xs text-gray-500 mb-2">ל: {deviceLabel}</p>}
      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} autoFocus placeholder="תוכן ההודעה"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </Modal>
  );
}

// ── device bits ──────────────────────────────────────────────────────────────

export function ProtectionChips({ status = {}, isDeviceOwner }) {
  const chips = [
    { key: 'accessibilityEnabled', label: 'נגישות' },
    { key: 'isDeviceAdmin', label: 'מנהל' },
    { key: 'vpnActive', label: 'VPN' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(c => {
        const ok = !!status[c.key];
        return (
          <span key={c.key} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {ok ? <Check size={11} /> : <X size={11} />}{c.label}
          </span>
        );
      })}
      {isDeviceOwner && <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-800 font-semibold">DO</span>}
    </div>
  );
}

export function OnlineBadge({ online }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0 ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
      {online ? 'מחובר' : 'לא פעיל'}
    </span>
  );
}

// Icons the managed devices uploaded are served behind admin auth, so they are fetched as blobs.
// The URL is content-addressed, so one fetch per hash per page load is enough.
const iconCache = new Map();
const loadIcon = (hash) => {
  if (!iconCache.has(hash)) {
    iconCache.set(hash, tetherApi.get(`/admin/app-icons/${hash}`, { headers: authHeader(), responseType: 'blob' })
      .then(r => URL.createObjectURL(r.data))
      .catch(() => null));
  }
  return iconCache.get(hash);
};

export function AppIcon({ packageName, label, iconHash, size = 32 }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (iconHash) loadIcon(iconHash).then(url => { if (alive) setSrc(url); });
    return () => { alive = false; };
  }, [iconHash]);

  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-lg shrink-0" style={{ width: size, height: size }} />;
  const letter = (label || packageName || '?').trim().charAt(0).toUpperCase();
  return (
    <span aria-hidden className="rounded-lg shrink-0 bg-gray-200 text-gray-600 font-semibold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}>{letter}</span>
  );
}

export function StickySaveBar({ onSave, saving, label }) {
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-gray-50/95 backdrop-blur border-t border-gray-200 mt-4">
      <button type="button" onClick={onSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-blue-900 text-white py-2.5 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-60">
        <Save size={16} /> {saving ? 'שומר...' : label}
      </button>
    </div>
  );
}
