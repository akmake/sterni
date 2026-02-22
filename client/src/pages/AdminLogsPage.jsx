import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';
import {
  Eye, EyeOff, Download, Trash2, RefreshCw, Activity,
  Monitor, Smartphone, Tablet, HelpCircle, Globe, Clock,
  Wifi, Cpu, ChevronDown, ChevronUp, Users, Zap, Search, X, Power, Cookie, MapPin,
  BatteryCharging, Shield, Fingerprint, MousePointer, Sun, Moon, Bot, Video, Mic, FileText, Layers
} from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================

const DeviceIcon = ({ type, size = 16 }) => {
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[type] || <HelpCircle size={size} />;
};

const OSIcon = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return '🪟';
  if (n.includes('mac') || n.includes('ios')) return '🍎';
  if (n.includes('android')) return '🤖';
  if (n.includes('linux') || n.includes('ubuntu')) return '🐧';
  return '💻';
};

const StatusDot = ({ code }) => {
  if (code >= 200 && code < 300) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />;
  if (code >= 400 && code < 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />;
  if (code >= 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />;
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `לפני ${diff} שניות`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return new Date(date).toLocaleDateString('he-IL') + ' ' + new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0 שנ׳';
  if (seconds < 60) return `${seconds} שנ׳`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} דק׳`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} שע׳ ${m} דק׳`;
};

// ============================================================
// COMPONENTS
// ============================================================

const StatCard = ({ icon, label, value, color = 'blue' }) => {
  const c = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
    green: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    rose: 'from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400',
  }[color] || 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400';

  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5 transition-all hover:scale-[1.02]`}>
      <div className="opacity-70 mb-3">{icon}</div>
      <div className="text-3xl font-black text-slate-100 tracking-tight">{value}</div>
      <div className="text-sm text-slate-400 mt-1 font-medium">{label}</div>
    </div>
  );
};

const MiniBar = ({ items = [], color = 'blue' }) => {
  const max = items[0]?.count || 1;
  const barColor = { blue: 'bg-blue-500', green: 'bg-emerald-500', purple: 'bg-purple-500', amber: 'bg-amber-500' }[color] || 'bg-blue-500';

  return (
    <div className="space-y-2.5">
      {items.slice(0, 6).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-slate-300 w-28 truncate text-left font-medium">{item._id || 'Unknown'}</span>
          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
          </div>
          <span className="text-xs text-slate-400 font-mono w-8 text-left">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const Detail = ({ icon, label, value, mono, small, className = '' }) => (
  <div className={className}>
    <div className="flex items-center gap-1 text-slate-500 text-xs mb-0.5">{icon}<span>{label}</span></div>
    <div className={`text-slate-200 ${mono ? 'font-mono' : ''} ${small ? 'text-xs break-all' : 'text-sm'}`}>{value || '—'}</div>
  </div>
);

const LogRow = ({ log, isExpanded, onToggle }) => (
  <div className={`border-b border-slate-700/50 transition-all cursor-pointer ${isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`} onClick={onToggle}>
    <div className="px-5 py-3.5 flex items-center gap-4">
      <div className="text-slate-400 shrink-0"><DeviceIcon type={log.device} size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-slate-200">{log.ipAddress}</span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-sm text-slate-400">{log.browser?.name || '?'} {log.browser?.version?.split('.')[0] || ''}</span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-sm text-slate-400"><OSIcon name={log.os?.name} /> {log.os?.name || '?'}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">{log.method} {log.page}</div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5"><StatusDot code={log.statusCode} /><span className="text-xs font-mono text-slate-400">{log.statusCode}</span></div>
        <span className="text-xs text-slate-500 font-mono">{log.responseTime}ms</span>
        <span className="text-xs text-slate-500 hidden sm:block">{timeAgo(log.timestamp)}</span>
        {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </div>
    </div>
    {isExpanded && (
      <div className="px-5 pb-4 pt-1 border-t border-slate-700/30">
        {/* ★ Detection flags / badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {log.userId && (
            <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-300 border border-blue-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Users size={10} /> {log.userId?.name || 'משתמש רשום'}
            </span>
          )}
          {log.session?.isNewSession && (
            <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              ✨ סשן חדש
            </span>
          )}
          {log.isTouchDevice && (
            <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <MousePointer size={10} /> מסך מגע
            </span>
          )}
          {log.prefersDarkMode && (
            <span className="inline-flex items-center gap-1 bg-slate-500/20 text-slate-300 border border-slate-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Moon size={10} /> מצב כהה
            </span>
          )}
          {log.prefersDarkMode === false && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Sun size={10} /> מצב בהיר
            </span>
          )}
          {log.doNotTrack && (
            <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-300 border border-rose-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Shield size={10} /> DNT
            </span>
          )}
          {log.adBlocker && (
            <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-300 border border-red-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Shield size={10} /> Ad Blocker
            </span>
          )}
          {log.webdriver && (
            <span className="inline-flex items-center gap-1 bg-orange-500/15 text-orange-300 border border-orange-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Bot size={10} /> בוט/אוטומציה
            </span>
          )}
          {log.battery?.charging && (
            <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-300 border border-green-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <BatteryCharging size={10} /> בטעינה
            </span>
          )}
          {log.isOnline === false && (
            <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-300 border border-red-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Wifi size={10} /> לא מחובר
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {log.location?.country && (
            <Detail icon={<MapPin size={14} />} label="מיקום" value={`${log.location.city || ''} ${log.location.country ? `(${log.location.country})` : ''}`.trim()} />
          )}
          <Detail icon={<Globe size={14} />} label="IP" value={log.ipAddress} mono />
          <Detail icon={<Monitor size={14} />} label="מערכת הפעלה" value={`${log.os?.name || '?'} ${log.os?.version || ''}`} />
          <Detail icon={<Globe size={14} />} label="דפדפן" value={`${log.browser?.name || '?'} ${log.browser?.version || ''}`} />
          <Detail icon={<DeviceIcon type={log.device} size={14} />} label="סוג התקן" value={log.device} />
          {log.screen?.width
            ? <Detail icon={<Monitor size={14} />} label="רזולוציה" value={`${log.screen.width} × ${log.screen.height}${log.screen.isRetina ? ' ✦' : ''}${log.screen.orientation ? ` · ${log.screen.orientation.includes('landscape') ? 'לרוחב' : 'לאורך'}` : ''}`} />
            : <Detail icon={<Monitor size={14} />} label="רזולוציה" value="לא זמין" />
          }
          <Detail
            icon={<Cookie size={14} />}
            label="עוגיות"
            value={log.cookies?.enabled != null
              ? `${log.cookies.enabled ? 'מופעל' : 'חסום'} · ${log.cookies.count ?? 0} עוגיות`
              : `${log.cookies?.count ?? 0} עוגיות`
            }
          />
          {log.processor?.cores && <Detail icon={<Cpu size={14} />} label="ליבות CPU" value={log.processor.cores} />}
          {log.deviceMemory && <Detail icon={<Cpu size={14} />} label="זיכרון" value={`${log.deviceMemory} GB`} />}
          {log.connection?.effectiveType && <Detail icon={<Wifi size={14} />} label="חיבור" value={log.connection.effectiveType.toUpperCase()} />}
          {log.connection?.rtt != null && <Detail icon={<Zap size={14} />} label="RTT" value={`${log.connection.rtt}ms`} mono />}
          {log.connection?.downlink != null && <Detail icon={<Zap size={14} />} label="Downlink" value={`${log.connection.downlink} Mbps`} mono />}
          {log.gpu?.renderer && <Detail icon={<Layers size={14} />} label="GPU" value={log.gpu.renderer} />}
          {log.battery?.level != null && (
            <Detail icon={<BatteryCharging size={14} />} label="סוללה" value={`${log.battery.level}%${log.battery.charging ? ' ⚡' : ''}`} />
          )}
          {log.session?.pageViews != null && (
            <Detail icon={<FileText size={14} />} label="דפים בסשן" value={`${log.session.pageViews} דפים · ${formatDuration(log.session.durationSeconds)}`} />
          )}
          {log.mediaDevices && (
            <Detail icon={<Video size={14} />} label="מדיה" value={`${log.mediaDevices.cameras || 0} מצלמות · ${log.mediaDevices.microphones || 0} מיקרופונים`} />
          )}
          {log.pluginsCount != null && <Detail icon={<Fingerprint size={14} />} label="תוספים" value={log.pluginsCount} />}
          {log.platform && <Detail label="פלטפורמה" value={log.platform} />}
          {log.userLanguage && <Detail label="שפה" value={log.languages?.length > 1 ? log.languages.join(', ') : log.userLanguage} />}
          {log.timezone && <Detail icon={<Clock size={14} />} label="אזור זמן" value={log.timezone} />}
          <Detail icon={<Clock size={14} />} label="זמן מדויק" value={new Date(log.timestamp).toLocaleString('he-IL')} />
          {log.referer && <Detail label="הגיע מ-" value={log.referer} className="col-span-2" />}
          <Detail label="User Agent" value={log.userAgent} className="col-span-full" mono small />
        </div>
      </div>
    )}
  </div>
);

// ============================================================
// MAIN PAGE
// ============================================================

const AdminLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [togglingLogging, setTogglingLogging] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [filterDevice, setFilterDevice] = useState('all');
  const [searchIP, setSearchIP] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedLog, setExpandedLog] = useState(null);

  // ★ טעינת סטטוס מהשרת בפעם הראשונה
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/logs/admin/status');
        setLoggingEnabled(res.data.loggingEnabled);
      } catch (err) {
        console.error('Error fetching logging status:', err);
      } finally {
        setStatusLoaded(true);
      }
    };
    fetchStatus();
  }, []);

  // ★ Toggle — שולח לשרת, לא רק מחליף state
  const handleToggleLogging = async () => {
    setTogglingLogging(true);
    try {
      const res = await api.post('/logs/admin/toggle', { enabled: !loggingEnabled });
      setLoggingEnabled(res.data.loggingEnabled);
      toast.success(res.data.loggingEnabled ? '✅ המעקב הופעל — כל כניסה תירשם' : '⛔ המעקב כבוי — לא נשמר כלום');
    } catch (err) {
      toast.error('שגיאה בשינוי ההגדרה');
    } finally {
      setTogglingLogging(false);
    }
  };

  // Fetch summary
  useEffect(() => {
    if (!loggingEnabled || !statusLoaded) return;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/logs/admin/summary');
        setSummary(res.data);
      } catch (err) { console.error(err); }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, [loggingEnabled, statusLoaded]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!loggingEnabled) return;
    setLoading(true);
    try {
      const params = { limit: 150 };
      if (filterDevice !== 'all') params.device = filterDevice;
      if (searchIP) params.ipAddress = searchIP;

      const res = await api.get('/logs/admin/all', { params });
      let data = res.data.data;

      if (sortBy === 'newest') data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (sortBy === 'oldest') data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (sortBy === 'slowest') data.sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0));

      setLogs(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [loggingEnabled, filterDevice, searchIP, sortBy]);

  useEffect(() => {
    if (!loggingEnabled || !statusLoaded) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 8000);
    return () => clearInterval(interval);
  }, [fetchLogs, statusLoaded]);

  const handleExportCSV = () => {
    if (!logs.length) return toast.error('אין לוגים');
    let csv = 'IP,Location,Browser,OS,Device,Screen,CPU,Memory,GPU,Battery,Connection,Dark Mode,Touch,Ad Blocker,Bot,Session Pages,Session Duration,Page,Method,Status,Response(ms),Time\n';
    logs.forEach((l) => {
      const yn = (v) => v === true ? 'Yes' : v === false ? 'No' : '';
      csv += `"${l.ipAddress}","${l.location?.city || ''} ${l.location?.country || ''}","${l.browser?.name || ''}","${l.os?.name || ''}","${l.device}","${l.screen?.width||''}x${l.screen?.height||''}","${l.processor?.cores||''}","${l.deviceMemory||''}","${l.gpu?.renderer||''}","${l.battery?.level != null ? l.battery.level + '%' : ''}","${l.connection?.effectiveType||''}","${yn(l.prefersDarkMode)}","${yn(l.isTouchDevice)}","${yn(l.adBlocker)}","${yn(l.webdriver)}","${l.session?.pageViews || ''}","${l.session?.durationSeconds || ''}","${l.page}","${l.method}","${l.statusCode}","${l.responseTime}","${new Date(l.timestamp).toLocaleString('he-IL')}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `logs_${new Date().toISOString().split('T')[0]}.csv` }).click();
    URL.revokeObjectURL(url);
    toast.success('CSV יורד');
  };

  const handleDeleteOld = async () => {
    if (!confirm('למחוק לוגים ישנים מ-30 יום?')) return;
    try {
      const res = await api.delete('/logs/admin/cleanup', { data: { days: 30 } });
      toast.success(res.data.message || 'הלוגים נמחקו');
      fetchLogs();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'שגיאה';
      toast.error(`שגיאה: ${msg}`);
      console.error('Delete logs error:', err);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ הודעה חשובה!\n\nהפעולה הזו תמחק את כל הלוגים במערכת — הפעולה בלתי הפיכה!\n\nהאם אתה בטוח?')) return;
    if (!confirm('🚨 אתה בטוח לגמרי? לא ניתן לשחזר לוגים שנמחקו!')) return;
    
    try {
      setLoading(true);
      const res = await api.delete('/logs/admin/delete-all');
      toast.success(`✅ נמחקו ${res.data.deletedCount} לוגים בהצלחה`);
      setLogs([]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'שגיאה';
      toast.error(`שגיאה: ${msg}`);
      console.error('Delete all logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  if (!statusLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" dir="rtl">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Activity size={24} className="text-blue-400" />
              </div>
              מעקב מבקרים
            </h1>
            <p className="text-slate-500 text-sm mt-1">ניטור בזמן אמת של כל הכניסות למערכת</p>
          </div>

          {/* ★ כפתור TOGGLE אמיתי — שולט על השרת */}
          <button
            onClick={handleToggleLogging}
            disabled={togglingLogging}
            className={`group relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60
              ${loggingEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-2 border-emerald-500/40 hover:bg-emerald-500/25 shadow-[0_0_20px_rgba(52,211,153,0.15)]'
                : 'bg-slate-800 text-slate-400 border-2 border-slate-600/40 hover:bg-slate-700 hover:text-slate-300'
              }`}
          >
            {/* נורית */}
            <div className={`relative w-3 h-3 rounded-full transition-all ${loggingEnabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}>
              {loggingEnabled && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />}
            </div>

            <Power size={16} />

            {togglingLogging ? 'מעדכן...' : loggingEnabled ? 'מעקב פעיל — לוגים נשמרים' : 'מעקב כבוי — לא נשמר כלום'}
          </button>
        </div>

        {/* ═══ OFF STATE ═══ */}
        {!loggingEnabled && (
          <div className="mt-16 text-center">
            <div className="inline-flex p-6 rounded-full bg-slate-800 border border-slate-700 mb-6">
              <EyeOff size={48} className="text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-400 mb-2">המעקב כבוי</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              כרגע לא נשמרים לוגים של מבקרים. לחץ על הכפתור למעלה כדי להתחיל לאסוף נתונים.
            </p>

            {/* עדיין מראים את הנתונים הקיימים אם יש */}
            {logs.length > 0 && (
              <div className="mt-8">
                <p className="text-slate-500 text-sm mb-4">יש {logs.length} לוגים ישנים שנשמרו קודם</p>
                <div className="flex justify-center gap-3">
                  <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-500/25 transition">
                    <Download size={14} /> ייצוא CSV
                  </button>
                  <button onClick={handleDeleteOld} className="flex items-center gap-1.5 bg-red-500/15 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-500/25 transition">
                    <Trash2 size={14} /> נקה ישנים
                  </button>
                  <button onClick={handleDeleteAll} disabled={!logs.length} className="flex items-center gap-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed" title="מחק את כל הלוגים">
                    <Trash2 size={14} /> 🗑️ מחק הכל
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ON STATE ═══ */}
        {loggingEnabled && (
          <>
            {/* STAT CARDS */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                <StatCard icon={<Users size={18} />} color="blue" value={summary.summary?.last24Hours || 0} label="כניסות היום" />
                <StatCard icon={<Globe size={18} />} color="green" value={summary.summary?.uniqueIPsToday || 0} label="IP ייחודיים היום" />
                <StatCard icon={<Activity size={18} />} color="purple" value={summary.summary?.last7Days || 0} label="כניסות השבוע" />
                <StatCard icon={<Zap size={18} />} color="amber" value={`${summary.summary?.avgResponseTime || 0}ms`} label="ממוצע תגובה" />
                <StatCard icon={<Users size={18} />} color="cyan" value={summary.summary?.uniqueUsers || 0} label="משתמשים רשומים" />
                <StatCard icon={<Globe size={18} />} color="rose" value={summary.summary?.uniqueIPs || 0} label="IP סה״כ" />
              </div>
            )}

            {/* CHARTS */}
            {summary?.analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-400" /> דפדפנים</h3>
                  <MiniBar items={summary.analytics.topBrowsers} color="blue" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Monitor size={16} className="text-emerald-400" /> מערכות הפעלה</h3>
                  <MiniBar items={summary.analytics.topOS} color="green" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Smartphone size={16} className="text-purple-400" /> התקנים</h3>
                  <MiniBar items={summary.analytics.topDevices} color="purple" />
                </div>
              </div>
            )}

            {/* TOP IPs */}
            {summary?.analytics?.topIPs?.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 mb-8">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Activity size={16} className="text-amber-400" /> IP הכי פעילים (7 ימים)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {summary.analytics.topIPs.slice(0, 10).map((ip, idx) => (
                    <div key={idx} className="bg-slate-700/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition" onClick={() => setSearchIP(ip._id)}>
                      <div className="font-mono text-sm text-slate-200 font-bold">{ip._id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ip.count} כניסות · {timeAgo(ip.lastSeen)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILTERS */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-700/40 rounded-lg overflow-hidden border border-slate-600/30">
                  {['all', 'desktop', 'mobile', 'tablet'].map((d) => (
                    <button key={d} onClick={() => setFilterDevice(d)}
                      className={`px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${filterDevice === d ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}>
                      {d === 'all' ? 'הכל' : <DeviceIcon type={d} size={14} />}
                      {d !== 'all' && <span className="hidden sm:inline">{d === 'desktop' ? 'מחשב' : d === 'mobile' ? 'נייד' : 'טאבלט'}</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center bg-slate-700/40 rounded-lg border border-slate-600/30 px-3 gap-2">
                  <Search size={14} className="text-slate-500" />
                  <input type="text" value={searchIP} onChange={(e) => setSearchIP(e.target.value)} placeholder="חפש IP..." className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 py-2 w-32" />
                  {searchIP && <button onClick={() => setSearchIP('')} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>}
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none">
                  <option value="newest">חדש ← ישן</option>
                  <option value="oldest">ישן ← חדש</option>
                  <option value="slowest">איטי ← מהיר</option>
                </select>
                <div className="flex-1" />
                <button onClick={fetchLogs} disabled={loading} className="flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition"><Download size={14} /> CSV</button>
                <button onClick={handleDeleteOld} className="flex items-center gap-1.5 bg-red-500/15 text-red-300 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500/25 transition"><Trash2 size={14} /> נקה</button>
                <button onClick={handleDeleteAll} disabled={loading || !logs.length} className="flex items-center gap-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed" title="מחק את כל הלוגים">
                  <Trash2 size={14} /> 🗑️ מחק הכל
                </button>
              </div>
            </div>

            {/* LOGS TABLE */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">📋 {logs.length} ביקורים</span>
                {loading && <RefreshCw size={14} className="animate-spin text-blue-400" />}
              </div>

              {loading && !logs.length ? (
                <div className="flex justify-center py-16">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
                    <p className="text-slate-500 text-sm">טוען...</p>
                  </div>
                </div>
              ) : !logs.length ? (
                <div className="py-16 text-center">
                  <Activity size={40} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium">אין ביקורים עדיין</p>
                  <p className="text-slate-600 text-sm mt-1">ביקורים חדשים יופיעו כאן אוטומטית</p>
                </div>
              ) : (
                <div>
                  {logs.map((log, idx) => (
                    <LogRow key={log._id || idx} log={log} isExpanded={expandedLog === idx} onToggle={() => setExpandedLog(expandedLog === idx ? null : idx)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogsPage;