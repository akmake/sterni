import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';
import {
  Eye, EyeOff, Download, Trash2, RefreshCw, Activity,
  Monitor, Smartphone, Tablet, HelpCircle, Globe, Clock,
  Wifi, Cpu, ChevronDown, ChevronUp, Users, Zap, Search, X
} from 'lucide-react';

// ============================================================
// ICONS / HELPERS
// ============================================================

const DeviceIcon = ({ type, size = 16 }) => {
  const map = {
    desktop: <Monitor size={size} />,
    mobile: <Smartphone size={size} />,
    tablet: <Tablet size={size} />,
  };
  return map[type] || <HelpCircle size={size} />;
};

const OSIcon = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return '🪟';
  if (n.includes('mac') || n.includes('ios')) return '🍎';
  if (n.includes('android')) return '🤖';
  if (n.includes('linux')) return '🐧';
  if (n.includes('ubuntu')) return '🐧';
  return '💻';
};

const StatusDot = ({ code }) => {
  if (code >= 200 && code < 300) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />;
  if (code >= 400 && code < 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />;
  if (code >= 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />;
};

const timeAgo = (date) => {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `לפני ${diff} שניות`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

// ============================================================
// STAT CARD
// ============================================================

const StatCard = ({ icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
    green: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    rose: 'from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400',
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5 transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-3xl font-black text-slate-100 tracking-tight">{value}</div>
      <div className="text-sm text-slate-400 mt-1 font-medium">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
};

// ============================================================
// BAR CHART (simple CSS)
// ============================================================

const MiniBar = ({ items = [], color = 'blue' }) => {
  const max = items[0]?.count || 1;
  const barColors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500',
  };
  const barColor = barColors[color] || barColors.blue;

  return (
    <div className="space-y-2.5">
      {items.slice(0, 6).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-slate-300 w-28 truncate text-left font-medium" title={item._id}>
            {item._id || 'Unknown'}
          </span>
          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 font-mono w-8 text-left">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// LOG ROW — כרטיס מבקר אחד
// ============================================================

const LogRow = ({ log, isExpanded, onToggle }) => {
  return (
    <div
      className={`border-b border-slate-700/50 transition-all cursor-pointer
        ${isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`}
      onClick={onToggle}
    >
      {/* שורה ראשית */}
      <div className="px-5 py-3.5 flex items-center gap-4">
        {/* Device icon */}
        <div className="text-slate-400 shrink-0">
          <DeviceIcon type={log.device} size={20} />
        </div>

        {/* IP + Browser */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-200">{log.ipAddress}</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400">
              {log.browser?.name || '?'} {log.browser?.version?.split('.')[0] || ''}
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400">
              <OSIcon name={log.os?.name} /> {log.os?.name || '?'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {log.method} {log.page}
          </div>
        </div>

        {/* Status + Time */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <StatusDot code={log.statusCode} />
            <span className="text-xs font-mono text-slate-400">{log.statusCode}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">{log.responseTime}ms</span>
          <span className="text-xs text-slate-500 hidden sm:block">{timeAgo(log.timestamp)}</span>
          {isExpanded
            ? <ChevronUp size={14} className="text-slate-500" />
            : <ChevronDown size={14} className="text-slate-500" />
          }
        </div>
      </div>

      {/* פרטים מורחבים */}
      {isExpanded && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-700/30">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <Detail icon={<Globe size={14} />} label="IP" value={log.ipAddress} mono />
            <Detail icon={<Monitor size={14} />} label="מערכת הפעלה" value={`${log.os?.name || '?'} ${log.os?.version || ''}`} />
            <Detail icon={<Globe size={14} />} label="דפדפן" value={`${log.browser?.name || '?'} ${log.browser?.version || ''}`} />
            <Detail icon={<DeviceIcon type={log.device} size={14} />} label="סוג התקן" value={log.device || 'unknown'} />
            {log.screen?.width && (
              <Detail icon={<Monitor size={14} />} label="רזולוציה" value={`${log.screen.width} × ${log.screen.height}`} />
            )}
            {log.screen?.isRetina && (
              <Detail label="רטינה" value="✅ כן" />
            )}
            {log.processor?.cores && (
              <Detail icon={<Cpu size={14} />} label="ליבות CPU" value={log.processor.cores} />
            )}
            {log.deviceMemory && (
              <Detail icon={<Cpu size={14} />} label="זיכרון" value={`${log.deviceMemory} GB`} />
            )}
            {log.connection?.effectiveType && (
              <Detail icon={<Wifi size={14} />} label="חיבור" value={log.connection.effectiveType.toUpperCase()} />
            )}
            {log.connection?.rtt != null && (
              <Detail icon={<Zap size={14} />} label="RTT" value={`${log.connection.rtt}ms`} mono />
            )}
            {log.platform && (
              <Detail label="פלטפורמה" value={log.platform} />
            )}
            {log.userLanguage && (
              <Detail label="שפה" value={log.userLanguage} />
            )}
            {log.timezone && (
              <Detail icon={<Clock size={14} />} label="אזור זמן" value={log.timezone} />
            )}
            <Detail icon={<Clock size={14} />} label="זמן מדויק" value={new Date(log.timestamp).toLocaleString('he-IL')} />
            {log.referer && (
              <Detail label="הגיע מ-" value={log.referer} className="col-span-2" />
            )}
            <Detail label="User Agent" value={log.userAgent} className="col-span-full" mono small />
          </div>
        </div>
      )}
    </div>
  );
};

const Detail = ({ icon, label, value, mono, small, className = '' }) => (
  <div className={className}>
    <div className="flex items-center gap-1 text-slate-500 text-xs mb-0.5">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-slate-200 ${mono ? 'font-mono' : ''} ${small ? 'text-xs break-all' : 'text-sm'}`}>
      {value || '—'}
    </div>
  </div>
);

// ============================================================
// MAIN PAGE
// ============================================================

const AdminLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [filterDevice, setFilterDevice] = useState('all');
  const [searchIP, setSearchIP] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedLog, setExpandedLog] = useState(null);

  // Fetch summary
  useEffect(() => {
    if (!loggingEnabled) return;

    const fetchSummary = async () => {
      try {
        const response = await api.get('/logs/admin/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Error fetching logs summary:', error);
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, [loggingEnabled]);

  // Fetch logs
  const fetchLogs = async () => {
    if (!loggingEnabled) return;
    setLoading(true);
    try {
      const params = { limit: 150 };
      if (filterDevice !== 'all') params.device = filterDevice;
      if (searchIP) params.ipAddress = searchIP;

      const response = await api.get('/logs/admin/all', { params });
      let data = response.data.data;

      if (sortBy === 'newest') data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (sortBy === 'oldest') data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (sortBy === 'slowest') data.sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0));

      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loggingEnabled) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 8000);
    return () => clearInterval(interval);
  }, [loggingEnabled, filterDevice, searchIP, sortBy]);

  const handleExportCSV = () => {
    if (logs.length === 0) return toast.error('אין לוגים לייצוא');

    let csv = 'IP,Browser,OS,Device,Screen,CPU Cores,Memory(GB),Connection,Page,Method,Status,Response Time(ms),Timestamp\n';
    logs.forEach((log) => {
      csv += `"${log.ipAddress}","${log.browser?.name}","${log.os?.name}","${log.device}","${log.screen?.width || ''}x${log.screen?.height || ''}","${log.processor?.cores || ''}","${log.deviceMemory || ''}","${log.connection?.effectiveType || ''}","${log.page}","${log.method}","${log.statusCode}","${log.responseTime}","${new Date(log.timestamp).toLocaleString('he-IL')}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Hebrew in Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('הקובץ יורד');
  };

  const handleDeleteOldLogs = async () => {
    if (!confirm('למחוק לוגים ישנים מ-30 יום?')) return;
    try {
      const res = await api.delete('/logs/admin/cleanup', { data: { days: 30 } });
      toast.success(res.data.message || 'נמחק בהצלחה');
      fetchLogs();
    } catch (error) {
      toast.error('שגיאה במחיקה');
    }
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" dir="rtl">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">

        {/* ═══════ HEADER ═══════ */}
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLoggingEnabled(!loggingEnabled)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                loggingEnabled
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
              }`}
            >
              {loggingEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
              {loggingEnabled ? 'מעקב פעיל' : 'מעקב כבוי'}
            </button>
          </div>
        </div>

        {!loggingEnabled && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-5 rounded-2xl mb-8 text-center font-medium">
            ⚠️ המעקב כבוי כרגע. הדליק אותו כדי לראות נתונים.
          </div>
        )}

        {loggingEnabled && (
          <>
            {/* ═══════ STAT CARDS ═══════ */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                <StatCard
                  icon={<Users size={18} />} color="blue"
                  value={summary.summary?.last24Hours || 0}
                  label="כניסות היום"
                />
                <StatCard
                  icon={<Globe size={18} />} color="green"
                  value={summary.summary?.uniqueIPsToday || summary.summary?.uniqueIPs || 0}
                  label="IP ייחודיים היום"
                />
                <StatCard
                  icon={<Activity size={18} />} color="purple"
                  value={summary.summary?.last7Days || 0}
                  label="כניסות השבוע"
                />
                <StatCard
                  icon={<Zap size={18} />} color="amber"
                  value={`${summary.summary?.avgResponseTime || 0}ms`}
                  label="ממוצע תגובה"
                />
                <StatCard
                  icon={<Users size={18} />} color="cyan"
                  value={summary.summary?.uniqueUsers || 0}
                  label="משתמשים רשומים"
                />
                <StatCard
                  icon={<Globe size={18} />} color="rose"
                  value={summary.summary?.uniqueIPs || 0}
                  label="IP ייחודיים (סה״כ)"
                />
              </div>
            )}

            {/* ═══════ ANALYTICS CHARTS ═══════ */}
            {summary?.analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Globe size={16} className="text-blue-400" /> דפדפנים
                  </h3>
                  <MiniBar items={summary.analytics.topBrowsers} color="blue" />
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Monitor size={16} className="text-emerald-400" /> מערכות הפעלה
                  </h3>
                  <MiniBar items={summary.analytics.topOS} color="green" />
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Smartphone size={16} className="text-purple-400" /> התקנים
                  </h3>
                  <MiniBar items={summary.analytics.topDevices} color="purple" />
                </div>
              </div>
            )}

            {/* ═══════ TOP IPs ═══════ */}
            {summary?.analytics?.topIPs?.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 mb-8">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-amber-400" /> כתובות IP הכי פעילות (7 ימים)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {summary.analytics.topIPs.slice(0, 10).map((ip, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-700/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition"
                      onClick={() => { setSearchIP(ip._id); }}
                    >
                      <div className="font-mono text-sm text-slate-200 font-bold">{ip._id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {ip.count} כניסות · {timeAgo(ip.lastSeen)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════ FILTERS ═══════ */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                {/* Device filter */}
                <div className="flex bg-slate-700/40 rounded-lg overflow-hidden border border-slate-600/30">
                  {['all', 'desktop', 'mobile', 'tablet'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDevice(d)}
                      className={`px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5
                        ${filterDevice === d ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {d === 'all' ? 'הכל' : <DeviceIcon type={d} size={14} />}
                      {d !== 'all' && <span className="hidden sm:inline">{d === 'desktop' ? 'מחשב' : d === 'mobile' ? 'נייד' : 'טאבלט'}</span>}
                    </button>
                  ))}
                </div>

                {/* IP search */}
                <div className="flex items-center bg-slate-700/40 rounded-lg border border-slate-600/30 px-3 gap-2">
                  <Search size={14} className="text-slate-500" />
                  <input
                    type="text"
                    value={searchIP}
                    onChange={(e) => setSearchIP(e.target.value)}
                    placeholder="חפש IP..."
                    className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 py-2 w-32"
                  />
                  {searchIP && (
                    <button onClick={() => setSearchIP('')} className="text-slate-500 hover:text-slate-300">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/40"
                >
                  <option value="newest">חדש ← ישן</option>
                  <option value="oldest">ישן ← חדש</option>
                  <option value="slowest">איטי ← מהיר</option>
                </select>

                <div className="flex-1" />

                {/* Actions */}
                <button
                  onClick={fetchLogs}
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  רענן
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={handleDeleteOldLogs}
                  className="flex items-center gap-1.5 bg-red-500/15 text-red-300 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500/25 transition"
                >
                  <Trash2 size={14} /> נקה
                </button>
              </div>
            </div>

            {/* ═══════ LOGS LIST ═══════ */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">
                  📋 {logs.length} ביקורים
                </span>
                {loading && <RefreshCw size={14} className="animate-spin text-blue-400" />}
              </div>

              {loading && logs.length === 0 ? (
                <div className="flex justify-center py-16">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
                    <p className="text-slate-500 text-sm">טוען...</p>
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center">
                  <Activity size={40} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium">אין ביקורים להצגה</p>
                  <p className="text-slate-600 text-sm mt-1">ביקורים חדשים יופיעו כאן אוטומטית</p>
                </div>
              ) : (
                <div>
                  {logs.map((log, idx) => (
                    <LogRow
                      key={log._id || idx}
                      log={log}
                      isExpanded={expandedLog === idx}
                      onToggle={() => setExpandedLog(expandedLog === idx ? null : idx)}
                    />
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