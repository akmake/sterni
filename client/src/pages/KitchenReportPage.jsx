import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Utensils,
  Printer,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Users,
  Info,
  LayoutList,
  Layers,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MEAL_LABELS = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
  light: 'ארוחה קלה',
  night_treats: 'פינוקי לילה',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function heDate(d, pattern = 'dd/MM/yyyy') {
  return format(d, pattern, { locale: he });
}

function getKosherMeta(kosherType) {
  const isMeat = kosherType === 'meat';
  const isParve = kosherType === 'parve';
  if (isMeat) return { label: 'בשרי', tone: 'meat' };
  if (isParve) return { label: 'פרווה', tone: 'parve' };
  return null;
}

function KosherBadge({ kosherType }) {
  const meta = getKosherMeta(kosherType);
  if (!meta) return null;

  const toneClass =
    meta.tone === 'meat'
      ? 'bg-red-50 text-red-700 border-red-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-100';

  return (
    <span
      className={cx(
        'text-[11px] px-2 py-0.5 rounded-md border font-bold',
        toneClass,
        'print:bg-transparent print:text-black print:border-black'
      )}
    >
      {meta.label}
    </span>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="space-y-3 py-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-20 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse print:shadow-none"
        />
      ))}
    </div>
  );
}

export default function KitchenReportPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [reportData, setReportData] = useState([]);
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

  const fetchReport = async () => {
    setLoading(true);
    try {
      const start = currentWeekStart.toISOString();
      const end = addDays(weekEnd, 1).toISOString();

      const { data } = await api.get('/groups/reports/kitchen', {
        params: { startDate: start, endDate: end },
      });

      setReportData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart]);

  /**
   * יום עסקים: 06:00 → 06:00
   * אם אירוע מתחיל לפני 06:00, הוא משויך ליום הקודם,
   * וממויין בסוף אותו יום ע"י sortValue (שעת לילה +24).
   */
  const processed = useMemo(() => {
    const dailyMap = {};
    const groupMap = {};

    weekDays.forEach((day) => {
      dailyMap[day.toDateString()] = [];
    });

    for (const event of reportData) {
      let eventDate = new Date(event.date);

      const [hRaw, mRaw] = String(event.startTime || '00:00').split(':');
      const h = Number(hRaw);
      const m = Number(mRaw);

      // תיקון יום עסקים: לפני 06:00 שייך ליום הקודם
      if (h < 6) eventDate = subDays(eventDate, 1);

      // מיון בתוך יום: שעות לילה מקבלות +24 כדי להופיע בסוף היום
      const sortValue = (h < 6 ? h + 24 : h) * 60 + (Number.isFinite(m) ? m : 0);

      const processedEvent = { ...event, sortValue, _businessDate: eventDate };

      const dateKey = eventDate.toDateString();

      // תצוגה יומית (רק ימים בשבוע הנוכחי הוכנו מראש)
      if (dailyMap[dateKey]) dailyMap[dateKey].push(processedEvent);

      // תצוגה לפי קבוצות (רק בטווח השבוע הנוכחי)
      if (eventDate >= currentWeekStart && eventDate <= weekEnd) {
        const gName = event.groupName || 'ללא שם';
        if (!groupMap[gName]) groupMap[gName] = { totalPax: 0, events: [] };
        groupMap[gName].totalPax += Number(event.pax || 0);
        groupMap[gName].events.push(processedEvent);
      }
    }

    // מיון יומי
    Object.keys(dailyMap).forEach((k) => {
      dailyMap[k].sort((a, b) => (a.sortValue ?? 0) - (b.sortValue ?? 0));
    });

    // מיון קבוצתי לפי תאריך ואז שעה
    Object.keys(groupMap).forEach((g) => {
      groupMap[g].events.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return (a.sortValue ?? 0) - (b.sortValue ?? 0);
      });
    });

    const weekEventsCount = Object.values(dailyMap).reduce((acc, arr) => acc + arr.length, 0);
    const weekPaxTotal = reportData.reduce((acc, e) => acc + Number(e?.pax || 0), 0);

    return { dailyMap, groupMap, weekEventsCount, weekPaxTotal };
  }, [reportData, currentWeekStart, weekEnd, weekDays]);

  const { dailyMap, groupMap, weekEventsCount, weekPaxTotal } = processed;

  const hasAnyData = useMemo(() => {
    return Object.values(dailyMap).some((arr) => arr.length > 0);
  }, [dailyMap]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dir-rtl print:bg-white">
      {/* PRINT-SAFE GLOBAL RULES:
         1) מבטל scroll containers שמייצרים “צילום מסך”
         2) מבטל אפקטים שגורמים ל-rasterization
         3) משפר שבירות עמוד */}
      <style>{`
        @media print {
          @page { margin: 12mm; }

          html, body { height: auto !important; overflow: visible !important; }
          #__next, #root { height: auto !important; overflow: visible !important; }
          main { height: auto !important; overflow: visible !important; }

          /* מניעת "צילום מסך" עקב אפקטים */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          body {
            background: #fff !important;
            -webkit-print-color-adjust: economy;
            print-color-adjust: economy;
          }

          .print-only { display: block !important; }
          .screen-only { display: none !important; }

          .print-break-avoid { break-inside: avoid; page-break-inside: avoid; }
          .print-break-before { break-before: page; page-break-before: always; }
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
                דוח מטבח ולוגיסטיקה
              </h1>
              <div className="mt-1 text-slate-600 flex items-center gap-2">
                <CalendarDays size={16} className="text-slate-400" />
                <span className="font-medium">שבוע: {weekRangeText}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* View toggle */}
              <div className="bg-white rounded-2xl border border-slate-200 p-1 flex shadow-sm">
                <button
                  onClick={() => setViewMode('daily')}
                  className={cx(
                    'px-3 py-2 text-sm font-bold rounded-xl transition',
                    viewMode === 'daily'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <LayoutList size={16} className="inline ml-1" />
                  לפי יום
                </button>
                <button
                  onClick={() => setViewMode('groups')}
                  className={cx(
                    'px-3 py-2 text-sm font-bold rounded-xl transition',
                    viewMode === 'groups'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Layers size={16} className="inline ml-1" />
                  לפי קבוצות
                </button>
              </div>

              {/* Week nav */}
              <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                  aria-label="שבוע קודם"
                >
                  <ArrowRight size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                >
                  השבוע
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                  aria-label="שבוע הבא"
                >
                  <ArrowLeft size={18} />
                </Button>
              </div>

              <Button
                onClick={() => window.print()}
                className="bg-slate-900 text-white gap-2 shadow-sm hover:bg-slate-800"
              >
                <Printer size={18} />
                הדפס
              </Button>
            </div>
          </div>

          {/* Quick stats */}
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
        {/* PRINT HEADER + PRINT CONTENT (טבלאי, קל, לא “צילום מסך”) */}
        <div className="print-only">
          <div className="border-b pb-3 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Utensils className="text-black" />
                <div>
                  <div className="text-xl font-black">דוח מטבח ולוגיסטיקה</div>
                  <div className="text-sm">שבוע: {weekRangeText}</div>
                  <div className="text-xs text-slate-700">יום עסקים: 06:00 → 06:00</div>
                </div>
              </div>
              <div className="text-xs text-left text-slate-700">
                הופק בתאריך {new Date().toLocaleDateString('he-IL')}
              </div>
            </div>
          </div>

          {!loading && !hasAnyData && (
            <div className="text-sm text-slate-800">אין אירועים לשבוע זה.</div>
          )}

          {!loading && hasAnyData && viewMode === 'daily' && (
            <div className="space-y-6">
              {weekDays.map((dayDate) => {
                const dateKey = dayDate.toDateString();
                const dayEvents = dailyMap[dateKey] || [];
                if (!dayEvents.length) return null;

                return (
                  <div key={dateKey} className="print-break-avoid">
                    <div className="mb-2">
                      <div className="text-base font-black">
                        {format(dayDate, 'EEEE', { locale: he })} — {heDate(dayDate)}
                      </div>
                      <div className="text-xs text-slate-700">אירועים: {dayEvents.length}</div>
                    </div>

                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-slate-400 p-1 text-right w-[78px]">שעה</th>
                          <th className="border border-slate-400 p-1 text-right w-[130px]">סוג</th>
                          <th className="border border-slate-400 p-1 text-right">קבוצה</th>
                          <th className="border border-slate-400 p-1 text-right w-[130px]">מיקום</th>
                          <th className="border border-slate-400 p-1 text-right w-[62px]">סועדים</th>
                          <th className="border border-slate-400 p-1 text-right">הערות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayEvents.map((ev, i) => {
                          const mealLabel = MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                          const loc = ev.hall?.name || ev.locationText || '---';
                          const kosher = getKosherMeta(ev.kosherType)?.label || '';
                          const notes = ev.requirements ? String(ev.requirements) : '';
                          return (
                            <tr key={i}>
                              <td className="border border-slate-400 p-1 font-bold">
                                {String(ev.startTime || '')}-{String(ev.endTime || '')}
                              </td>
                              <td className="border border-slate-400 p-1">
                                {mealLabel}
                                {kosher ? ` (${kosher})` : ''}
                              </td>
                              <td className="border border-slate-400 p-1">{ev.groupName || '—'}</td>
                              <td className="border border-slate-400 p-1">{loc}</td>
                              <td className="border border-slate-400 p-1 font-bold">{Number(ev.pax || 0)}</td>
                              <td className="border border-slate-400 p-1 whitespace-pre-wrap">{notes}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && hasAnyData && viewMode === 'groups' && (
            <div className="space-y-6">
              {Object.keys(groupMap)
                .sort((a, b) => (groupMap[b]?.totalPax || 0) - (groupMap[a]?.totalPax || 0))
                .map((groupName) => {
                  const g = groupMap[groupName];
                  return (
                    <div key={groupName} className="print-break-avoid">
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="text-base font-black">{groupName}</div>
                        <div className="text-xs">
                          סה״כ סועדים: <span className="font-black">{g.totalPax}</span>
                        </div>
                      </div>

                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr>
                            <th className="border border-slate-400 p-1 text-right w-[62px]">תאריך</th>
                            <th className="border border-slate-400 p-1 text-right w-[78px]">שעה</th>
                            <th className="border border-slate-400 p-1 text-right">אירוע</th>
                            <th className="border border-slate-400 p-1 text-right w-[130px]">מיקום</th>
                            <th className="border border-slate-400 p-1 text-right w-[62px]">כמות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.events.map((ev, i) => {
                            const mealLabel = MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                            const loc = ev.hall?.name || ev.locationText || '---';
                            const kosher = getKosherMeta(ev.kosherType)?.label || '';
                            return (
                              <tr key={i}>
                                <td className="border border-slate-400 p-1">
                                  {format(new Date(ev.date), 'dd/MM', { locale: he })}
                                </td>
                                <td className="border border-slate-400 p-1">
                                  {String(ev.startTime || '')}-{String(ev.endTime || '')}
                                </td>
                                <td className="border border-slate-400 p-1">
                                  {mealLabel}
                                  {kosher ? ` (${kosher})` : ''}
                                </td>
                                <td className="border border-slate-400 p-1">{loc}</td>
                                <td className="border border-slate-400 p-1 font-bold">{Number(ev.pax || 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="mt-6 pt-2 border-t text-center text-[10px] text-slate-700">
            הופק ע"י מערכת ניהול בתאריך {new Date().toLocaleDateString('he-IL')}
          </div>
        </div>

        {/* SCREEN CONTENT (כרטיסים יפים) */}
        <div className="screen-only">
          {loading && <LoadingPlaceholder />}

          {!loading && !hasAnyData && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Info className="text-slate-500" />
              </div>
              <div className="mt-4 text-lg font-black">אין אירועים לשבוע הזה</div>
              <div className="mt-1 text-slate-600 font-medium">
                נסה לעבור שבוע, או בדוק שהנתונים קיימים בטווח התאריכים.
              </div>
            </div>
          )}

          {!loading && viewMode === 'daily' && hasAnyData && (
            <div className="space-y-8">
              {weekDays.map((dayDate) => {
                const dateKey = dayDate.toDateString();
                const dayEvents = dailyMap[dateKey] || [];
                if (!dayEvents.length) return null;

                const dayPax = dayEvents.reduce((acc, e) => acc + Number(e?.pax || 0), 0);

                return (
                  <section key={dateKey} className="break-inside-avoid page-break-inside-avoid">
                    <div className="flex items-center gap-4 mb-3 border-b border-slate-200 pb-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-sm">
                        <span className="text-xs font-bold leading-none">
                          {format(dayDate, 'EEE', { locale: he })}
                        </span>
                        <span className="text-2xl font-black leading-none mt-0.5">
                          {format(dayDate, 'dd')}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                          {format(dayDate, 'EEEE', { locale: he })}
                        </h2>
                        <div className="text-slate-600 text-sm font-medium">
                          {heDate(dayDate)} (עד 06:00 למחרת)
                        </div>
                      </div>

                      <div className="mr-auto flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700 border border-slate-200">
                          {dayEvents.length} אירועים
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 border border-blue-100">
                          {dayPax} סועדים
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {dayEvents.map((event, idx) => {
                        const kosherMeta = getKosherMeta(event.kosherType);
                        const barColor =
                          kosherMeta?.tone === 'meat'
                            ? 'bg-red-400'
                            : kosherMeta?.tone === 'parve'
                            ? 'bg-emerald-400'
                            : 'bg-slate-300';

                        const mealLabel = MEAL_LABELS[event.mealType] || event.title || 'אירוע';
                        const location = event.hall?.name || event.locationText || '---';
                        const pax = Number(event.pax || 0);
                        const groupName = event.groupName || '—';

                        return (
                          <article
                            key={`${dateKey}-${idx}`}
                            className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                          >
                            <div className={cx('absolute right-0 top-0 bottom-0 w-1.5', barColor)} />

                            <div className="p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div className="flex gap-4 pr-3">
                                  <div className="text-center min-w-[74px]">
                                    <div className="text-2xl font-black text-slate-900 leading-none font-mono">
                                      {event.startTime}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-bold mt-1">
                                      עד {event.endTime}
                                    </div>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-lg sm:text-xl font-black text-slate-900">
                                        {mealLabel}
                                      </h3>
                                      <KosherBadge kosherType={event.kosherType} />
                                    </div>

                                    <div className="mt-1 text-slate-700 text-sm font-semibold flex items-center gap-2">
                                      <Users size={14} className="text-slate-400" />
                                      <span className="truncate">{groupName}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                                  <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                    <MapPin size={14} className="text-slate-400" />
                                    <span className="text-sm font-extrabold text-slate-800">
                                      {location}
                                    </span>
                                  </div>

                                  <div className="text-center min-w-[72px] bg-white rounded-xl border border-slate-200 px-3 py-2">
                                    <div className="text-2xl font-black text-slate-900 leading-none">
                                      {pax}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase font-extrabold mt-1">
                                      סועדים
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {event.requirements && (
                                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 font-semibold flex items-start gap-2">
                                  <Info size={16} className="shrink-0 mt-0.5" />
                                  <div className="whitespace-pre-wrap">{event.requirements}</div>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {!loading && viewMode === 'groups' && hasAnyData && (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {Object.keys(groupMap)
                .sort((a, b) => (groupMap[b]?.totalPax || 0) - (groupMap[a]?.totalPax || 0))
                .map((groupName) => {
                  const groupData = groupMap[groupName];

                  return (
                    <section
                      key={groupName}
                      className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      <div className="p-5 border-b border-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-xl font-black text-slate-900 truncate">{groupName}</h3>
                            <div className="mt-1 text-sm text-slate-600 font-semibold">
                              {groupData.events.length} אירועים בשבוע
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-3xl font-black text-blue-700">{groupData.totalPax}</div>
                            <div className="text-xs text-slate-500 font-extrabold">סה״כ סועדים</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3">
                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="text-slate-600 text-xs text-right">
                                <th className="py-2 px-3 font-extrabold w-[88px]">תאריך</th>
                                <th className="py-2 px-3 font-extrabold">אירוע</th>
                                <th className="py-2 px-3 font-extrabold w-[72px]">כמות</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-800">
                              {groupData.events.map((ev, i) => {
                                const mealLabel = MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                                const loc = ev.hall?.name || ev.locationText || '---';
                                return (
                                  <tr
                                    key={i}
                                    className={cx(
                                      'border-t border-slate-200',
                                      i % 2 === 1 && 'bg-slate-50/50'
                                    )}
                                  >
                                    <td className="py-2 px-3 font-bold">
                                      {format(new Date(ev.date), 'dd/MM', { locale: he })}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-extrabold">{mealLabel}</span>
                                        <KosherBadge kosherType={ev.kosherType} />
                                      </div>
                                      <div className="text-xs text-slate-600 font-semibold mt-0.5">
                                        {String(ev.startTime || '')}–{String(ev.endTime || '')} · {loc}
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 font-black">{Number(ev.pax || 0)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
