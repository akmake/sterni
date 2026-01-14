import React, { useEffect, useMemo, useState } from 'react';
import useGroupsStore from '@/stores/groupsStore';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
  CalendarDays, 
  Printer, 
  ArrowRight, 
  ArrowLeft, 
  Filter, 
  Users, 
  LayoutGrid, 
  Clock, 
  MapPin 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PrintableSchedule from '@/components/reports/PrintableSchedule';

// --- Helpers ---
function heDate(d) {
  return format(d, 'dd/MM/yyyy', { locale: he });
}

function normalizeEventToRow(event) {
  const isMeal = Boolean(event.isMeal) || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
  const pax = Number(event.pax || 0);
  const startTime = event.startTime || '00:00';
  let endTime = event.endTime || ''; 
  
  return {
    ...event,
    startTime,
    endTime, 
    _isMeal: isMeal,
    _pax: Number.isFinite(pax) ? pax : 0,
  };
}

const getBusinessDaySortValue = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 6) return (hours + 24) * 60 + minutes;
    return hours * 60 + minutes;
};

export default function FullScheduleReportPage() {
  const { groups, fetchGroups } = useGroupsStore();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [loading, setLoading] = useState(false);

  const weekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 0 }), [currentWeekStart]);

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  // 1. סינון קבוצות ל-Dropdown (רק מי שפעיל השבוע)
  const activeGroupsThisWeek = useMemo(() => {
    if (!groups) return [];
    return groups.filter(group => {
      return (group.schedule || []).some(event => {
        if (!event.date) return false;
        let eventDate = parseISO(event.date);
        const [hRaw] = String(event.startTime || '00:00').split(':');
        if (Number(hRaw) < 6) eventDate = subDays(eventDate, 1);
        return isWithinInterval(eventDate, { start: currentWeekStart, end: weekEnd });
      });
    });
  }, [groups, currentWeekStart, weekEnd]);

  // 2. עיבוד נתונים לתצוגה
  const processedData = useMemo(() => {
    let targetGroups = groups || [];
    if (selectedGroupId !== 'all') {
      targetGroups = targetGroups.filter((g) => g._id === selectedGroupId);
    }

    const result = [];
    targetGroups.forEach((group) => {
      const daysMap = new Map();
      (group.schedule || []).forEach((event) => {
        if (!event?.date) return;
        let eventDate = parseISO(event.date);
        const [hRaw] = String(event.startTime || '00:00').split(':');
        if (Number(hRaw) < 6) eventDate = subDays(eventDate, 1);

        if (isWithinInterval(eventDate, { start: currentWeekStart, end: weekEnd })) {
          const dayKey = format(eventDate, 'yyyy-MM-dd');
          if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, { dateObj: eventDate, events: [] });
          }
          daysMap.get(dayKey).events.push(normalizeEventToRow(event));
        }
      });

      const days = Array.from(daysMap.values())
        .sort((a, b) => a.dateObj - b.dateObj)
        .map((day) => ({
          ...day,
          events: day.events.sort((a, b) => getBusinessDaySortValue(a.startTime) - getBusinessDaySortValue(b.startTime)),
        }));

      if (days.length > 0) result.push({ ...group, days });
    });
    return result;
  }, [groups, currentWeekStart, weekEnd, selectedGroupId]);

  // הכנת הדפים להדפסה (השטחה של הנתונים כפי שהיה בקוד המקורי שעבד לך)
  const printPages = useMemo(() => {
    const pages = [];
    processedData.forEach((group) => {
      group.days.forEach((day) => pages.push({ group, day }));
    });
    return pages;
  }, [processedData]);

  const onPrint = () => {
    document.documentElement.classList.add('print-mode');
    window.print();
    setTimeout(() => document.documentElement.classList.remove('print-mode'), 2000);
  };

  const weekLabel = `${heDate(currentWeekStart)} - ${heDate(weekEnd)}`;

  return (
    <>
      {/* --- תצוגת מסך בלבד --- */}
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 dir-rtl font-assistant pb-20 print:hidden">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-md shadow-indigo-100">
                <LayoutGrid className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">לו"ז שבועי</h1>
                <p className="text-xs text-slate-500 font-medium">{weekLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="h-10 pr-9 pl-4 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">כל הקבוצות הפעילות</option>
                  {activeGroupsThisWeek.map((g) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-white border border-slate-200 rounded-xl p-1">
                <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} className="p-2 hover:bg-slate-50 rounded-lg"><ArrowRight size={16} /></button>
                <button onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))} className="px-3 text-sm font-bold text-indigo-600">היום</button>
                <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} className="p-2 hover:bg-slate-50 rounded-lg"><ArrowLeft size={16} /></button>
              </div>

              <Button onClick={onPrint} className="bg-slate-900 hover:bg-black text-white rounded-xl h-10 px-5 gap-2 shadow-md">
                <Printer size={18} /> הדפס לו"ז
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-10">
          {processedData.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <CalendarDays size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-slate-500 font-bold text-lg">אין נתונים לשבוע זה</p>
             </div>
          ) : (
            <div className="space-y-10">
              {processedData.map((group) => (
                <div key={group._id}>
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-2xl font-black text-slate-800">{group.name}</h2>
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{group.pax || 0} PAX</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.days.map((day, i) => (
                      <div key={i} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-700">{format(day.dateObj, 'EEEE', { locale: he })}</span>
                          <span className="text-xs font-mono text-slate-400">{format(day.dateObj, 'dd/MM')}</span>
                        </div>
                        <div className="p-5 space-y-4">
                          {day.events.map((ev, j) => (
                            <div key={j} className="flex gap-3">
                              <div className={`w-1 rounded-full shrink-0 ${ev._isMeal ? 'bg-orange-400' : 'bg-indigo-500'}`} />
                              <div className="min-w-0">
                                <div className="text-[10px] font-mono font-bold text-slate-400 leading-none mb-1">{ev.startTime}</div>
                                <div className="text-sm font-bold text-slate-800 truncate">{ev.title}</div>
                                {ev.location && <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><MapPin size={10}/> {ev.location}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- רכיב ההדפסה - יופיע רק ב-Print --- */}
      <div className="hidden print:block">
        <PrintableSchedule 
          printPages={printPages} 
          weekLabel={weekLabel} 
        />
      </div>
    </>
  );
}