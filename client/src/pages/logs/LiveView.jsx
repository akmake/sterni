import React, { useState, useEffect, useRef } from 'react';
import api from '@/utils/api';
import {
  Radio, Monitor, Smartphone, Tablet, HelpCircle, MapPin, Shield, Bot, Globe, Users,
} from 'lucide-react';
import WorldMap from './WorldMap.jsx';

const DeviceIcon = ({ type, size = 16 }) => {
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[type] || <HelpCircle size={size} />;
};

const secsAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `לפני ${s} שנ׳`;
  return `לפני ${Math.floor(s / 60)} דק׳`;
};

const LiveView = () => {
  const [live, setLive] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const fetchLive = async () => {
      try {
        const res = await api.get('/logs/admin/live', { params: { minutes: 5 } });
        if (alive) setLive(res.data);
      } catch { /* ignore */ }
    };
    fetchLive();
    timer.current = setInterval(fetchLive, 8000);
    return () => { alive = false; clearInterval(timer.current); };
  }, []);

  const visitors = live?.data || [];
  const points = visitors
    .filter(v => v.lat != null && v.lon != null)
    .map(v => ({ lat: v.lat, lon: v.lon, count: 1, label: `${v.city || ''}${v.country ? ', ' + v.country : ''}`, suspicious: v.proxy || v.hosting }));

  return (
    <div>
      {/* Live header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <Radio size={22} className="text-emerald-400" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div>
          <div className="text-2xl font-black text-slate-100">{live?.activeCount ?? '—'} <span className="text-base font-normal text-slate-400">אונליין עכשיו</span></div>
          <div className="text-xs text-slate-500">פעילות ב-5 הדקות האחרונות · מתעדכן כל 8 שניות</div>
        </div>
      </div>

      {/* Map */}
      <div className="mb-5">
        <WorldMap points={points} height={380} />
      </div>

      {/* Active visitors list */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 text-sm font-bold text-slate-300 flex items-center gap-2">
          <Users size={16} className="text-emerald-400" /> מבקרים פעילים
        </div>
        {!visitors.length ? (
          <div className="py-14 text-center text-slate-500">
            <Globe size={36} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">אף אחד לא מחובר כרגע</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {visitors.map((v) => (
              <div key={v.key} className="px-4 py-3 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="text-slate-400"><DeviceIcon type={v.device} size={20} /></div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-200">{v.name || v.ip}</span>
                    {v.proxy && <span title="VPN/Proxy" className="text-rose-400"><Shield size={12} /></span>}
                    {v.hosting && <span title="Datacenter" className="text-orange-400"><Bot size={12} /></span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate font-mono">{v.currentPage}</div>
                </div>
                <div className="text-left shrink-0 text-xs">
                  <div className="text-slate-300 flex items-center gap-1 justify-end"><MapPin size={10} />{v.city && v.city !== 'Unknown' ? v.city : v.country || '?'}</div>
                  <div className="text-slate-500">{secsAgo(v.lastSeen)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;
