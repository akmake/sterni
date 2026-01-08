import React, { useState, useEffect, useMemo } from 'react';
import useGroupsStore from '@/stores/groupsStore';
import { startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { CalendarDays, LayoutList, Layers, ArrowRight, ArrowLeft, Printer, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ייבוא הקבצים החדשים
import { cx, heDate, getMealRank } from './KitchenReport/kitchenUtils';
import KitchenPrintView from './KitchenReport/KitchenPrintView';
import KitchenScreenView from './KitchenReport/KitchenScreenView';

// פונקציית עזר לדירוג הארוחות (השארתי כאן כי זה משמש רק למיון)
const getMealRankFn = (type) => {
  if (!type) return 4;
  const t = type.toLowerCase();
  if (t === 'breakfast' || t.includes('בוקר')) return 1;
  if (t === 'lunch' || t.includes('צהרים') || t.includes('צהריים')) return 2;
  if (t === 'dinner' || t.includes('ערב')) return 3;
  return 4; 
};

export default function KitchenReportPage() {
  const { groups, fetchGroups } = useGroupsStore();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'groups'

  const weekEnd = useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
    [currentWeekStart]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  const weekRangeText = useMemo(() => {
    return `${heDate(currentWeekStart)} - ${heDate(weekEnd)}`;
  }, [currentWeekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  // לוגיקת תפריט חכם
  const getSmartMenuName = (event) => {
    if (event.menuItem) return event.menuItem;
    const title = event.title || '';
    const dashMatch = title.match(/-\s+(.*?)(\s*\||$)/);
    if (dashMatch && dashMatch[1]) return dashMatch[1].trim();
    const colonMatch = title.match(/:\s+(.*?)(\s*\||$)/);
    if (colonMatch && colonMatch[1]) return colonMatch[1].trim();
    if (event.menu) return event.menu;
    if (event.description) return event.description;
    return '-';
  };

  const processed = useMemo(() => {
    const dailyMap = {};
    const groupMap = {};
    const flatReportData = [];

    groups.forEach(group => {
        const schedule = group.schedule || [];
        schedule.forEach(event => {
            const isMeal = event.isMeal || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
            
            if (isMeal) {
                flatReportData.push({
                    ...event,
                    date: event.date,
                    groupName: group.name,
                    pax: event.pax || 0,
                    smartMenu: getSmartMenuName(event) 
                });
            }
        });
    });

    weekDays.forEach((day) => {
      dailyMap[day.toDateString()] = [];
    });

    for (const event of flatReportData) {
      let eventDate = parseISO(event.date);

      const [hRaw, mRaw] = String(event.startTime || '00:00').split(':');
      const h = Number(hRaw);
      const m = Number(mRaw);

      if (h < 6) eventDate = subDays(eventDate, 1);

      const sortValue = (h < 6 ? h + 24 : h) * 60 + (Number.isFinite(m) ? m : 0);
      const processedEvent = { ...event, sortValue, _businessDate: eventDate };
      const dateKey = eventDate.toDateString();

      if (dailyMap[dateKey]) {
          dailyMap[dateKey].push(processedEvent);
      }

      if (eventDate >= currentWeekStart && eventDate <= weekEnd) {
        const gName = event.groupName || 'ללא שם';
        if (!groupMap[gName]) groupMap[gName] = { totalPax: 0, events: [] };
        groupMap[gName].totalPax += Number(event.pax || 0);
        groupMap[gName].events.push(processedEvent);
      }
    }

    Object.keys(dailyMap).forEach((k) => {
      dailyMap[k].sort((a, b) => {
        const rankA = getMealRankFn(a.mealType);
        const rankB = getMealRankFn(b.mealType);
        
        if (rankA !== rankB) return rankA - rankB;
        return (a.sortValue ?? 0) - (b.sortValue ?? 0);
      });
    });

    Object.keys(groupMap).forEach((g) => {
      groupMap[g].events.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return (a.sortValue ?? 0) - (b.sortValue ?? 0);
      });
    });

    const weekEventsCount = Object.values(dailyMap).reduce((acc, arr) => acc + arr.length, 0);
    const weekPaxTotal = flatReportData.reduce((acc, e) => {
        let d = parseISO(e.date);
        const [h] = String(e.startTime || '00:00').split(':');
        if (Number(h) < 6) d = subDays(d, 1);
        if (d >= currentWeekStart && d <= weekEnd) return acc + Number(e?.pax || 0);
        return acc;
    }, 0);

    return { dailyMap, groupMap, weekEventsCount, weekPaxTotal };
  }, [groups, currentWeekStart, weekEnd, weekDays]);

  const { dailyMap, groupMap, weekEventsCount, weekPaxTotal } = processed;

  const hasAnyData = useMemo(() => {
    return Object.values(dailyMap).some((arr) => arr.length > 0);
  }, [dailyMap]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dir-rtl print:bg-white font-sans">
      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { height: auto !important; overflow: visible !important; }
          #__next, #root { height: auto !important; overflow: visible !important; }
          main { height: auto !important; overflow: visible !important; }
          * { box-shadow: none !important; text-shadow: none !important; filter: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: economy; print-color-adjust: economy; }
          .print-only { display: block !important; }
          .screen-only { display: none !important; }
          .print-break-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* SCREEN TOP BAR */}
      <div className="screen-only sticky top-0 z-20 bg-slate-50/95 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[240px]">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100">
                  <Utensils className="text-orange-600" />
                </span>
                דוח מטבח
              </h1>
              <div className="mt-1 text-slate-600 flex items-center gap-2">
                <CalendarDays size={16} className="text-slate-400" />
                <span className="font-medium">שבוע: {weekRangeText}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-1 flex shadow-sm">
                <button
                  onClick={() => setViewMode('daily')}
                  className={cx(
                    'px-3 py-2 text-sm font-bold rounded-xl transition',
                    viewMode === 'daily' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <LayoutList size={16} className="inline ml-1" />
                  לפי יום
                </button>
                <button
                  onClick={() => setViewMode('groups')}
                  className={cx(
                    'px-3 py-2 text-sm font-bold rounded-xl transition',
                    viewMode === 'groups' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Layers size={16} className="inline ml-1" />
                  לפי קבוצות
                </button>
              </div>

              <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                  <ArrowRight size={18} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
                  השבוע
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                  <ArrowLeft size={18} />
                </Button>
              </div>

              <Button onClick={() => window.print()} className="bg-slate-900 text-white gap-2 shadow-sm hover:bg-slate-800">
                <Printer size={18} />
                הדפס
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 font-bold">סה״כ אירועים בשבוע</div>
              <div className="text-2xl font-black">{weekEventsCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 font-bold">סה״כ סועדים בשבוע</div>
              <div className="text-2xl font-black">{weekPaxTotal}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 font-bold">טווח יום עסקים</div>
              <div className="text-sm font-extrabold mt-1">06:00 → 06:00</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 font-bold">מצב</div>
              <div className="text-sm font-extrabold mt-1">
                {loading ? 'טוען נתונים…' : hasAnyData ? 'מוכן' : 'אין אירועים לשבוע הזה'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT WRAPPER */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 print:max-w-none print:px-6 print:py-4">
        
        {/* --- קריאה לקומפוננטת הדפסה --- */}
        <KitchenPrintView 
          loading={loading}
          hasAnyData={hasAnyData}
          viewMode={viewMode}
          weekRangeText={weekRangeText}
          dailyMap={dailyMap}
          weekDays={weekDays}
          groupMap={groupMap}
        />

        {/* --- קריאה לקומפוננטת מסך --- */}
        <KitchenScreenView
           loading={loading}
           hasAnyData={hasAnyData}
           viewMode={viewMode}
           weekDays={weekDays}
           dailyMap={dailyMap}
           groupMap={groupMap}
        />

      </div>
    </div>
  );
}