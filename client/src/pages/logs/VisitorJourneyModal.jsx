import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { X, FileText, Clock, MousePointer, ArrowDownUp, Activity, ExternalLink } from 'lucide-react';

const fmtTime = (d) => new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const methodColor = (m) =>
  m === 'GET' ? 'text-emerald-400' : m === 'POST' ? 'text-amber-400' : m === 'DELETE' ? 'text-red-400' : 'text-blue-400';

// Gap > 30 min between hits = a new session
const SESSION_GAP = 30 * 60 * 1000;

const VisitorJourneyModal = ({ visitor, onClose }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/logs/admin/journey', { params: { key: visitor.key } });
        if (alive) setEvents(res.data.data || []);
      } catch { /* ignore */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [visitor.key]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div>
            <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
              <Activity size={18} className="text-blue-400" /> מסע המבקר
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {visitor.name || (visitor.fingerprint ? `טביעה ${visitor.fingerprint}` : visitor.key)}
              {visitor.city && ` · ${visitor.city}`}{visitor.country ? `, ${visitor.country}` : ''}
              {visitor.isp && ` · ${visitor.isp}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1"><X size={20} /></button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-px bg-slate-700/40 border-b border-slate-700/60 text-center">
          {[
            { label: 'ביקורים', val: visitor.visits },
            { label: 'דפים', val: visitor.uniquePages },
            { label: 'ימים פעילים', val: visitor.daysActive },
            { label: 'סטטוס', val: visitor.isReturning ? 'חוזר' : 'חדש' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 py-3">
              <div className="text-xl font-black text-slate-100">{s.val}</div>
              <div className="text-[10px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto p-5 flex-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : !events.length ? (
            <p className="text-center text-slate-500 py-10 text-sm">אין אירועים</p>
          ) : (
            <div className="relative pr-4">
              <div className="absolute right-[7px] top-1 bottom-1 w-px bg-slate-700" />
              {events.map((e, i) => {
                const prev = events[i - 1];
                const newSession = prev && (new Date(e.timestamp) - new Date(prev.timestamp) > SESSION_GAP);
                const b = e.behavior;
                return (
                  <div key={i}>
                    {newSession && (
                      <div className="flex items-center gap-2 my-3 text-[10px] text-slate-500">
                        <div className="flex-1 border-t border-dashed border-slate-700" />
                        סשן חדש
                        <div className="flex-1 border-t border-dashed border-slate-700" />
                      </div>
                    )}
                    <div className="relative pr-5 pb-3">
                      <span className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-blue-500" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold ${methodColor(e.method)}`}>{e.method}</span>
                        <span className="text-sm text-slate-200 font-mono truncate max-w-[280px]" title={e.page}>{e.page}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock size={10} />{fmtTime(e.timestamp)}</span>
                      </div>
                      {b && (b.activeSeconds || b.maxScrollDepth || b.clicks) ? (
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                          {b.activeSeconds != null && <span className="flex items-center gap-0.5"><Clock size={9} /> {b.activeSeconds}שנ׳ פעיל</span>}
                          {b.maxScrollDepth != null && <span className="flex items-center gap-0.5"><ArrowDownUp size={9} /> {b.maxScrollDepth}% גלילה</span>}
                          {b.clicks != null && <span className="flex items-center gap-0.5"><MousePointer size={9} /> {b.clicks} קליקים</span>}
                          {b.rageClicks > 0 && <span className="text-rose-400 font-bold">⚡ {b.rageClicks} rage</span>}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/60 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <FileText size={11} /> {events.length} אירועים · {visitor.ips?.length || 1} כתובות IP
        </div>
      </div>
    </div>
  );
};

export default VisitorJourneyModal;
