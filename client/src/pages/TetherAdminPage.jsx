import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Shield, LogOut, Users, Smartphone, CheckCircle, XCircle,
  Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Copy,
  AlertTriangle, Lock, Unlock, Settings, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ── Tether API helper ────────────────────────────────────────────────────────
const tetherApi = axios.create({ baseURL: '/api/tether' });

const getToken = () => localStorage.getItem('tetherToken');
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

// ── Tether local session ─────────────────────────────────────────────────────
const saveTetherSession = (token, user) => {
  localStorage.setItem('tetherToken', token);
  localStorage.setItem('tetherUser', JSON.stringify(user));
};
const clearTetherSession = () => {
  localStorage.removeItem('tetherToken');
  localStorage.removeItem('tetherUser');
};
const loadTetherUser = () => {
  try { return JSON.parse(localStorage.getItem('tetherUser')); } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Login ────────────────────────────────────────────────────────────────────
function TetherLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await tetherApi.post('/auth/login', { email, password });
      saveTetherSession(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-900 text-white rounded-full p-4 mb-4">
            <Shield size={36} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tether — כניסת מנהל</h1>
          <p className="text-gray-500 text-sm mt-1">פאנל ניהול מכשירים</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, actRes] = await Promise.all([
        tetherApi.get('/admin/dashboard', { headers: authHeader() }),
        tetherApi.get('/admin/activity', { headers: authHeader() }),
      ]);
      setStats(statsRes.data);
      setActivity(actRes.data);
    } catch {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const timeAgo = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return 'כרגע';
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע'`;
    return `לפני ${Math.floor(diff / 86400)} ימים`;
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'קהילות', value: stats?.totalCommunities ?? 0, color: 'bg-blue-50 text-blue-800', icon: <Shield size={20} /> },
          { label: 'מכשירים פעילים', value: stats?.totalDevices ?? 0, color: 'bg-green-50 text-green-800', icon: <Smartphone size={20} /> },
          { label: 'בקשות ממתינות', value: stats?.pendingApprovals ?? 0, color: 'bg-orange-50 text-orange-800', icon: <AlertTriangle size={20} /> },
          { label: 'לא פעילים 7 ימים', value: stats?.inactiveDevices ?? 0, color: 'bg-red-50 text-red-800', icon: <XCircle size={20} /> },
        ].map(card => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 flex items-center gap-3`}>
            {card.icon}
            <div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">פעילות אחרונה</h2>
        {activity.length === 0
          ? <p className="text-gray-400 text-sm">אין פעילות</p>
          : (
            <ul className="divide-y divide-gray-50">
              {activity.map((a, i) => (
                <li key={i} className="py-2.5 flex justify-between items-start text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{a.description}</span>
                    {a.communityName && <span className="text-gray-500 mr-1"> — {a.communityName}</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 mr-4">{timeAgo(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

// ── Policy Editor ─────────────────────────────────────────────────────────────
function PolicyEditor({ communityId, initialPolicy, onSaved }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setPolicy(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await tetherApi.put(`/admin/communities/${communityId}/policy`, policy, { headers: authHeader() });
      toast.success('פוליסי עודכן');
      onSaved(policy);
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const toggleRow = (key, label) => (
    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        onClick={() => toggle(key)}
        className={`w-10 h-5 rounded-full transition relative ${policy[key] ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition ${policy[key] ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-3" dir="rtl">
      <h4 className="font-semibold text-gray-700 mb-3">הגדרות פוליסי</h4>
      {toggleRow('blockInstallApps', 'חסום התקנת אפליקציות')}
      {toggleRow('hideGooglePlay', 'הסתר Google Play')}
      {toggleRow('blockSafeBoot', 'חסום מצב בטוח')}
      {toggleRow('blockFactoryReset', 'חסום איפוס יצרן')}
      {toggleRow('blockUsbTransfer', 'חסום העברת קבצים USB')}
      {toggleRow('logsEnabled', 'הפעל לוגים')}

      <div className="mt-3">
        <label className="text-xs text-gray-500 mb-1 block">התנהגות בפעולה חסומה</label>
        <select
          value={policy.blockedActionBehavior}
          onChange={e => setPolicy(p => ({ ...p, blockedActionBehavior: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="SILENT">שקט</option>
          <option value="SHOW_MESSAGE">הצג הודעה</option>
          <option value="REQUEST_APPROVAL">בקשת אישור</option>
        </select>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 bg-blue-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition"
      >
        {saving ? 'שומר...' : 'שמור פוליסי'}
      </button>
    </div>
  );
}

// ── Community Card ────────────────────────────────────────────────────────────
function CommunityCard({ community, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editPolicy, setEditPolicy] = useState(false);
  const [approvals, setApprovals] = useState([]);

  const loadDetail = async () => {
    if (detail) return;
    setLoadingDetail(true);
    try {
      const [detRes, appRes] = await Promise.all([
        tetherApi.get(`/admin/communities/${community._id}`, { headers: authHeader() }),
        tetherApi.get(`/admin/communities/${community._id}/approvals`, { headers: authHeader() }),
      ]);
      setDetail(detRes.data);
      setApprovals(appRes.data);
    } catch {
      toast.error('שגיאה בטעינת פרטים');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggle = () => {
    if (!open) loadDetail();
    setOpen(!open);
  };

  const removeDevice = async (deviceId) => {
    if (!confirm('להסיר מכשיר זה מהקהילה?')) return;
    try {
      await tetherApi.delete(`/admin/devices/${deviceId}`, { headers: authHeader() });
      setDetail(d => ({ ...d, devices: d.devices.filter(dev => dev.deviceId !== deviceId) }));
      toast.success('מכשיר הוסר');
    } catch {
      toast.error('שגיאה בהסרה');
    }
  };

  const resolveApproval = async (id, status) => {
    try {
      await tetherApi.put(`/admin/approvals/${id}`, { status }, { headers: authHeader() });
      setApprovals(a => a.filter(r => r._id !== id));
      toast.success(status === 'approved' ? 'אושר' : 'נדחה');
    } catch {
      toast.error('שגיאה');
    }
  };

  const deleteCommunity = async () => {
    if (!confirm(`למחוק את קהילה "${community.name}"?`)) return;
    try {
      await tetherApi.delete(`/admin/communities/${community._id}`, { headers: authHeader() });
      toast.success('קהילה נמחקה');
      onDeleted(community._id);
    } catch {
      toast.error('שגיאה במחיקה');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(community.code);
    toast.success('קוד הועתק');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-right"
      >
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-800 rounded-lg p-2">
            <Users size={18} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{community.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              קוד: <span className="font-mono font-medium">{community.code}</span>
              <button onClick={e => { e.stopPropagation(); copyCode(); }} className="text-gray-400 hover:text-gray-600">
                <Copy size={12} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${community.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {community.active !== false ? 'פעיל' : 'מושבת'}
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4" dir="rtl">
          {loadingDetail ? (
            <div className="text-center py-6 text-gray-400 text-sm">טוען...</div>
          ) : detail ? (
            <div className="space-y-4 pt-4">

              {/* Devices */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Smartphone size={16} /> מכשירים ({detail.devices?.length ?? 0})
                </h4>
                {detail.devices?.length === 0
                  ? <p className="text-xs text-gray-400">אין מכשירים</p>
                  : (
                    <div className="space-y-2">
                      {detail.devices.map(dev => (
                        <div key={dev._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{dev.deviceModel}</span>
                            <span className="text-xs text-gray-400 mr-2">({dev.deviceId?.slice(-8)})</span>
                            {dev.isDeviceOwner && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">Device Owner</span>}
                          </div>
                          <button
                            onClick={() => removeDevice(dev.deviceId)}
                            className="text-red-400 hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Approvals */}
              {approvals.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" /> בקשות אישור ({approvals.length})
                  </h4>
                  <div className="space-y-2">
                    {approvals.map(req => (
                      <div key={req._id} className="bg-orange-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                        <div>
                          <span className="font-medium">{req.action}</span>
                          {req.packageName && <span className="text-gray-500 mr-1 text-xs">({req.packageName})</span>}
                          <div className="text-xs text-gray-400">{req.deviceId?.slice(-8)}</div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => resolveApproval(req._id, 'approved')} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => resolveApproval(req._id, 'rejected')} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Policy */}
              <div>
                <button
                  onClick={() => setEditPolicy(!editPolicy)}
                  className="flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-900"
                >
                  <Settings size={15} />
                  {editPolicy ? 'סגור פוליסי' : 'ערוך פוליסי'}
                </button>
                {editPolicy && (
                  <PolicyEditor
                    communityId={community._id}
                    initialPolicy={detail.community.policy}
                    onSaved={(p) => setDetail(d => ({ ...d, community: { ...d.community, policy: p } }))}
                  />
                )}
              </div>

              {/* Delete */}
              <div className="pt-2 border-t border-gray-100">
                <button onClick={deleteCommunity} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 size={12} /> מחק קהילה
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Communities Tab ───────────────────────────────────────────────────────────
function CommunitiesTab() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/communities', { headers: authHeader() });
      setCommunities(data);
    } catch {
      toast.error('שגיאה בטעינת קהילות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await tetherApi.post('/admin/communities', { name: newName.trim() }, { headers: authHeader() });
      setCommunities(c => [...c, data]);
      setNewName('');
      setShowCreate(false);
      toast.success(`קהילה "${data.name}" נוצרה`);
    } catch {
      toast.error('שגיאה ביצירת קהילה');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">קהילות ({communities.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition"
        >
          <Plus size={15} /> צור קהילה
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="שם הקהילה"
            required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={creating} className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
            {creating ? '...' : 'צור'}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700 px-2">ביטול</button>
        </form>
      )}

      {communities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-40" />
          <p>אין קהילות עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {communities.map(c => (
            <CommunityCard
              key={c._id}
              community={c}
              onDeleted={(id) => setCommunities(prev => prev.filter(x => x._id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Approvals Tab ─────────────────────────────────────────────────────────────
function ApprovalsTab() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/approvals/all', { headers: authHeader() });
      setApprovals(data);
    } catch {
      toast.error('שגיאה בטעינת בקשות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, status) => {
    try {
      await tetherApi.put(`/admin/approvals/${id}`, { status }, { headers: authHeader() });
      setApprovals(a => a.filter(r => r._id !== id));
      toast.success(status === 'approved' ? 'אושר' : 'נדחה');
    } catch {
      toast.error('שגיאה');
    }
  };

  const timeAgo = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return 'כרגע';
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע'`;
    return `לפני ${Math.floor(diff / 86400)} ימים`;
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">בקשות אישור ממתינות ({approvals.length})</h2>
        <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-40 text-green-500" />
          <p>אין בקשות ממתינות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map(req => (
            <div key={req._id} className="bg-white border border-orange-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">{req.action}</div>
                {req.packageName && <div className="text-xs text-gray-500 mt-0.5">{req.packageName}</div>}
                <div className="text-xs text-gray-400 mt-1">מכשיר: {req.deviceId?.slice(-12)} · {timeAgo(req.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resolve(req._id, 'approved')}
                  className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm hover:bg-green-200 transition"
                >
                  <CheckCircle size={14} /> אשר
                </button>
                <button
                  onClick={() => resolve(req._id, 'rejected')}
                  className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-200 transition"
                >
                  <XCircle size={14} /> דחה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admins Tab (superadmin only) ──────────────────────────────────────────────
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/members', { headers: authHeader() });
      setAdmins(data);
    } catch (err) {
      if (err.response?.status === 403) toast.error('גישה מותרת לסופר-אדמין בלבד');
      else toast.error('שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await tetherApi.post('/admin/members/invite', form, { headers: authHeader() });
      setAdmins(a => [...a, data]);
      setForm({ name: '', email: '', password: '' });
      setShowCreate(false);
      toast.success('מנהל נוסף');
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally {
      setCreating(false);
    }
  };

  const removeAdmin = async (id) => {
    if (!confirm('להסיר מנהל זה?')) return;
    try {
      await tetherApi.delete(`/admin/members/${id}`, { headers: authHeader() });
      setAdmins(a => a.filter(m => m._id !== id));
      toast.success('מנהל הוסר');
    } catch {
      toast.error('שגיאה');
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">מנהלים ({admins.length})</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition"
        >
          <Plus size={15} /> הוסף מנהל
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createAdmin} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-700">הוספת מנהל חדש</h3>
          {[
            { key: 'name', placeholder: 'שם מלא', type: 'text' },
            { key: 'email', placeholder: 'אימייל', type: 'email' },
            { key: 'password', placeholder: 'סיסמה', type: 'password' },
          ].map(f => (
            <input
              key={f.key}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
              {creating ? '...' : 'הוסף'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 text-sm hover:text-gray-700">ביטול</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {admins.map(a => (
          <div key={a._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">{a.name}</div>
              <div className="text-xs text-gray-500">{a.email}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${a.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {a.role === 'superadmin' ? 'סופר אדמין' : 'מנהל'}
              </span>
            </div>
            {a.active !== false && (
              <button
                onClick={() => removeAdmin(a._id)}
                className="text-red-400 hover:text-red-600 p-1.5 rounded"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'communities', label: 'קהילות' },
  { id: 'approvals', label: 'אישורים' },
  { id: 'admins', label: 'מנהלים' },
];

export default function TetherAdminPage() {
  const [tetherUser, setTetherUser] = useState(() => loadTetherUser());
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogin = (user) => setTetherUser(user);

  const handleLogout = () => {
    clearTetherSession();
    setTetherUser(null);
  };

  if (!tetherUser) {
    return <TetherLogin onLogin={handleLogin} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 text-white rounded-xl p-2.5">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tether</h1>
            <p className="text-xs text-gray-500">שלום, {tetherUser.name} · {tetherUser.role === 'superadmin' ? 'סופר אדמין' : 'מנהל'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
        >
          <LogOut size={14} /> התנתק
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${
              activeTab === tab.id
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard'    && <Dashboard />}
      {activeTab === 'communities'  && <CommunitiesTab />}
      {activeTab === 'approvals'    && <ApprovalsTab />}
      {activeTab === 'admins'       && <AdminsTab />}
    </div>
  );
}
