import React, { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import {
  Users, UserPlus, RefreshCw, Shield, Bot, Globe, Monitor, Smartphone, Tablet, HelpCircle,
  MapPin, Wifi, ChevronLeft, Repeat, AlertTriangle, Search as SearchIcon,
} from 'lucide-react';
import VisitorJourneyModal from './VisitorJourneyModal.jsx';

const SOURCE_META = {
  direct:    { label: 'ישיר', color: 'bg-slate-500/15 text-slate-300', icon: '🔗' },
  google:    { label: 'Google', color: 'bg-blue-500/15 text-blue-300', icon: '🔍' },
  search:    { label: 'חיפוש', color: 'bg-cyan-500/15 text-cyan-300', icon: '🔎' },
  whatsapp:  { label: 'WhatsApp', color: 'bg-emerald-500/15 text-emerald-300', icon: '💬' },
  social:    { label: 'רשת חברתית', color: 'bg-purple-500/15 text-purple-300', icon: '📱' },
  internal:  { label: 'פנימי', color: 'bg-indigo-500/15 text-indigo-300', icon: '🏠' },
  referral:  { label: 'הפניה', color: 'bg-amber-500/15 text-amber-300', icon: '↗️' },
};

const DeviceIcon = ({ type, size = 14 }) => {
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[type] || <HelpCircle size={size} />;
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `לפני ${diff} שנ׳`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
};

const StatCard = ({ icon, label, value, color }) => (
  <div className={`bg-gradient-to-br ${color} border rounded-2xl p-4`}>
    <div className="opacity-70 mb-2">{icon}</div>
    <div className="text-2xl font-black text-slate-100">{value}</div>
    <div className="text-xs text-slate-400 mt-0.5">{label}</div>
  </div>
);

const VisitorsView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200, days: 30 };
      if (onlySuspicious) params.suspicious = 'true';
      const res = await api.get('/logs/admin/visitors', { params });
      setData(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [onlySuspicious]);

  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);

  const visitors = (data?.data || []).filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (v.ips || []).some(ip => ip.includes(q)) ||
      (v.city || '').toLowerCase().includes(q) ||
      (v.country || '').toLowerCase().includes(q) ||
      (v.isp || '').toLowerCase().includes(q) ||
      (v.name || '').toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard icon={<Users size={18} />} label="סה״כ מבקרים" value={data.summary.total} color="from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400" />
          <StatCard icon={<Repeat size={18} />} label="חוזרים" value={data.summary.returning} color="from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400" />
          <StatCard icon={<UserPlus size={18} />} label="חדשים" value={data.summary.newVisitors} color="from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400" />
          <StatCard icon={<AlertTriangle size={18} />} label="חשודים" value={data.summary.suspicious} color="from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400" />
        </div>
      )}

      {/* Source breakdown */}
      {data?.sourceBreakdown && Object.keys(data.sourceBreakdown).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Globe size={16} className="text-blue-400" /> מקורות תנועה</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
              const meta = SOURCE_META[src] || SOURCE_META.referral;
              return (
                <span key={src} className={`inline-flex items-center gap-1.5 ${meta.color} px-3 py-1.5 rounded-full text-xs font-bold`}>
                  <span>{meta.icon}</span> {meta.label} <span className="opacity-70">· {count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center bg-slate-700/40 rounded-lg border border-slate-600/30 px-3 gap-2">
          <SearchIcon size={14} className="text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="IP / עיר / ספק / שם..." className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 py-2 w-44" />
        </div>
        <button onClick={() => setOnlySuspicious(s => !s)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${onlySuspicious ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-700/40 text-slate-400 border-slate-600/30 hover:text-slate-200'}`}>
          <AlertTriangle size={14} /> רק חשודים
        </button>
        <div className="flex-1" />
        <button onClick={fetchVisitors} disabled={loading} className="flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 text-sm font-bold text-slate-300">
          👤 {visitors.length} מבקרים ייחודיים (30 ימים)
        </div>
        {loading && !visitors.length ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>
        ) : !visitors.length ? (
          <div className="py-16 text-center text-slate-500 text-sm">אין מבקרים בטווח</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {visitors.map((v) => {
              const meta = SOURCE_META[v.source] || SOURCE_META.referral;
              return (
                <div key={v.key} onClick={() => setSelected(v)} className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-slate-800/50 transition">
                  <div className="text-slate-400 shrink-0"><DeviceIcon type={v.device} size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-200">{v.name || (v.fingerprint ? `🔑 ${v.fingerprint}` : v.ips?.[0] || v.key)}</span>
                      {v.isReturning
                        ? <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">חוזר</span>
                        : <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded-full font-bold">חדש</span>}
                      {v.proxy && <span title="VPN/Proxy" className="text-rose-400"><Shield size={12} /></span>}
                      {v.hosting && <span title="Datacenter" className="text-orange-400"><Bot size={12} /></span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5"><MapPin size={10} />{v.city && v.city !== 'Unknown' ? `${v.city}, ` : ''}{v.country || '?'}</span>
                      {v.isp && <span className="flex items-center gap-0.5"><Wifi size={10} />{v.isp}</span>}
                      <span className={`inline-flex items-center gap-1 ${meta.color} px-1.5 py-0.5 rounded-full text-[10px] font-bold`}>{meta.icon} {meta.label}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0 hidden sm:block">
                    <div className="text-sm font-bold text-slate-200">{v.visits} ביקורים</div>
                    <div className="text-[11px] text-slate-500">{v.uniquePages} דפים · {timeAgo(v.lastSeen)}</div>
                  </div>
                  <ChevronLeft size={16} className="text-slate-600 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <VisitorJourneyModal visitor={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default VisitorsView;
