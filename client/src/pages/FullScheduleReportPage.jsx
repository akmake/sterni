import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useGroupsStore from '@/stores/groupsStore';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  CalendarDays,
  Printer,
  ArrowRight,
  ArrowLeft,
  Filter,
  Users,
  MapPin,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ----------------------
// Helpers
// ----------------------
function heDate(d) {
  return format(d, 'dd/MM/yyyy', { locale: he });
}

function getSmartMenuName(event) {
  if (event.menuItem) return event.menuItem;

  const title = event.title || '';
  const dashMatch = title.match(/-\s+(.*?)(\s*\||$)/);
  if (dashMatch && dashMatch[1]) return dashMatch[1].trim();

  if (event.menu) return event.menu;
  return '';
}

function normalizeEventToRow(event) {
  const isMeal =
    Boolean(event.isMeal) ||
    event.eventType === 'meal' ||
    (event.mealType && event.mealType !== 'regular');

  const smartDetail = isMeal
    ? getSmartMenuName(event)
    : (event.description || event.requirements || event.notes || '');

  const pax = Number(event.pax || 0);

  return {
    ...event,
    _isMeal: isMeal,
    _smartDetail: smartDetail,
    _pax: Number.isFinite(pax) ? pax : 0,
  };
}

// ----------------------
// Print portal root (outside app layout / scroll containers)
// ----------------------
function usePrintPortalRoot() {
  const [el, setEl] = useState(null);

  useEffect(() => {
    let root = document.getElementById('print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-root';
      document.body.appendChild(root);
    }
    setEl(root);

    return () => {
      // לא מוחקים כדי לא “לרצד” בין כניסות/יציאות; אם אתה רוצה למחוק — אפשר.
      // root?.remove();
    };
  }, []);

  return el;
}

export default function FullScheduleReportPage() {
  const { groups, fetchGroups } = useGroupsStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [loading, setLoading] = useState(false);

  const weekEnd = useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
    [currentWeekStart]
  );

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  // ----------------------
  // Data processing: groups -> days -> events
  // ----------------------
  const processedData = useMemo(() => {
    let targetGroups = groups || [];
    if (selectedGroupId !== 'all') {
      targetGroups = targetGroups.filter((g) => g._id === selectedGroupId);
    }

    const result = [];

    targetGroups.forEach((group) => {
      const schedule = group.schedule || [];
      const daysMap = new Map(); // key: yyyy-MM-dd -> { dateObj, events: [] }

      schedule.forEach((event) => {
        if (!event?.date) return;

        let eventDate = parseISO(event.date);

        // Business-day rule: events before 06:00 belong to previous day
        const [hRaw] = String(event.startTime || '00:00').split(':');
        if (Number(hRaw) < 6) eventDate = subDays(eventDate, 1);

        // חשוב: ההשוואה כאן עובדת על Date. אם event.date אצלך כולל שעה/UTC,
        // זה עדיין תקין לרוב. אם יש בעיות טיים-זון, נתקן לפי format('yyyy-MM-dd') בהמשך.
        if (eventDate >= currentWeekStart && eventDate <= weekEnd) {
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
          events: (day.events || []).slice().sort((a, b) => {
            const aT = String(a.startTime || '00:00');
            const bT = String(b.startTime || '00:00');
            return aT.localeCompare(bT);
          }),
        }));

      if (days.length > 0) {
        result.push({ ...group, days });
      }
    });

    return result;
  }, [groups, currentWeekStart, weekEnd, selectedGroupId]);

  // Flatten: each item = EXACTLY one printed page (group + day)
  const printPages = useMemo(() => {
    const pages = [];
    processedData.forEach((group) => {
      group.days.forEach((day) => pages.push({ group, day }));
    });
    return pages;
  }, [processedData]);

  const weekLabel = `${heDate(currentWeekStart)} - ${heDate(weekEnd)}`;

  // Print portal root
  const printRoot = usePrintPortalRoot();

  // Toggle a class during print (optional but helps some browsers)
  useEffect(() => {
    const onBeforePrint = () => document.documentElement.classList.add('print-mode');
    const onAfterPrint = () => document.documentElement.classList.remove('print-mode');
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  const onPrint = () => {
    // טיפ קטן: להוסיף class רגע לפני print מעלה יציבות במספר דפדפנים
    document.documentElement.classList.add('print-mode');
    window.print();
    // afterprint יוריד. אם לא יופעל, מסירים אחרי רגע.
    setTimeout(() => document.documentElement.classList.remove('print-mode'), 2000);
  };

  return (
    <>
      {/* ----------------------
          Global print CSS:
          - Hide app root in print
          - Show print-root in print
          - Real page breaks per day
         ---------------------- */}
      <style>{`
        /* Screen default: do NOT show print-root */
        #print-root { display: none; }

        @media print {
          /* Hide the entire app (root) so nothing "screen-y" leaks into PDF */
          #root { display: none !important; }

          /* Show the print portal content */
          #print-root { display: block !important; }

          @page {
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
          }

          html, body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: auto !important;
            overflow: visible !important;
          }

          /* אם יש לך Layout כללי עם overflow/height, זה מנטרל אותו בהדפסה */
          .print-mode body, .print-mode html {
            height: auto !important;
            overflow: visible !important;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* "מסמך" */
          .print-doc {
            direction: rtl;
            color: #0f172a; /* slate-900-ish */
            font-family: Assistant, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          }

          /* כל יום = דף */
          .day-page {
            box-sizing: border-box;
            min-height: calc(297mm - 14mm - 16mm);
            display: flex;
            flex-direction: column;
            break-after: page;
            page-break-after: always;
          }

          /* עמוד אחרון בלי break כדי למנוע "דף ריק" */
          .day-page.is-last {
            break-after: auto;
            page-break-after: auto;
          }

          /* מניעת חיתוך שורות באמצע */
          .avoid-break, .row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* טיפוגרפיה */
          .print-title { letter-spacing: -0.02em; }
          .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        }
      `}</style>

      {/* ----------------------
          SCREEN UI
         ---------------------- */}
      <div className="min-h-screen bg-gray-50 text-slate-900 dir-rtl font-assistant">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">לו"ז קבוצות מפורט</h1>
              <p className="text-sm text-slate-500 font-medium">{weekLabel}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="h-10 pr-9 pl-4 rounded-xl border border-gray-300 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">כל הקבוצות</option>
                  {(groups || []).map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex bg-white border border-gray-300 rounded-xl p-1">
                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="שבוע קודם"
                >
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                  className="px-3 text-sm font-bold"
                >
                  השבוע
                </button>

                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="שבוע הבא"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>

              <Button
                onClick={onPrint}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-6 gap-2 shadow-lg"
              >
                <Printer size={18} /> הדפס
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {!loading && processedData.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
              <div className="text-xl font-bold">אין נתונים להצגה</div>
              <div className="mt-2 text-sm text-slate-500">בחר שבוע או קבוצה אחרת</div>
            </div>
          )}

          <div className="grid gap-6">
            {processedData.map((group) => (
              <div
                key={group._id}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">{group.name}</h2>
                  <span className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                    {group.days.length} ימי פעילות
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {group.days.map((day, i) => (
                    <div key={i} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                      <div className="font-bold text-slate-900 mb-3">
                        {format(day.dateObj, 'EEEE dd/MM', { locale: he })}
                      </div>
                      <div className="space-y-2">
                        {day.events.slice(0, 5).map((ev, j) => (
                          <div key={j} className="text-xs flex items-center justify-between text-slate-600">
                            <span className="truncate flex-1 font-medium">{ev.title}</span>
                            <span className="mono text-[10px] bg-white px-1 rounded border border-gray-200">
                              {ev.startTime}
                            </span>
                          </div>
                        ))}
                        {day.events.length > 5 && (
                          <div className="text-xs text-center text-slate-400 pt-1 font-medium">
                            + עוד {day.events.length - 5} אירועים
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {processedData.length > 0 && (
            <div className="mt-6 text-sm text-slate-500">
              להדפסה נקייה: לחץ "הדפס" — ההדפסה מתבצעת כמסמך A4 אמיתי, יום לכל דף.
            </div>
          )}
        </div>
      </div>

      {/* ----------------------
          PRINT DOCUMENT (Portal to body)
         ---------------------- */}
      {printRoot &&
        createPortal(
          <div className="print-doc">
            {printPages.length === 0 ? (
              <div className="day-page is-last">
                <div className="border-b-2 border-slate-900 pb-6 mb-8">
                  <div className="text-3xl font-black text-slate-900 print-title">דו"ח שבועי</div>
                  <div className="text-sm font-semibold text-slate-600 mt-2">{weekLabel}</div>
                </div>
                <div className="text-slate-500">אין נתונים לשבוע הנבחר.</div>
              </div>
            ) : (
              printPages.map(({ group, day }, idx) => {
                const isLast = idx === printPages.length - 1;
                const pageNo = idx + 1;
                const totalPages = printPages.length;

                return (
                  <div
                    key={`${group._id}-${format(day.dateObj, 'yyyy-MM-dd')}`}
                    className={`day-page ${isLast ? 'is-last' : ''}`}
                  >
                    {/* Header */}
                    <div className="avoid-break flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                      <div>
                        <h1 className="print-title text-4xl font-black text-slate-900 mb-2">
                          {group.name}
                        </h1>

                        <div className="flex items-center gap-6 text-sm font-semibold text-slate-600">
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                            <Users size={14} /> {group.pax} משתתפים
                          </span>

                          {group.contactPerson?.name && (
                            <span className="flex items-center gap-1.5">
                              <Info size={14} /> {group.contactPerson.name}
                              {group.contactPerson.phone ? ` (${group.contactPerson.phone})` : ''}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          שבוע: {weekLabel}
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="text-3xl font-black text-slate-900 uppercase">
                          {format(day.dateObj, 'EEEE', { locale: he })}
                        </div>
                        <div className="text-xl font-medium text-slate-500 tracking-widest">
                          {format(day.dateObj, 'dd.MM.yyyy')}
                        </div>
                      </div>
                    </div>

                    {/* Table header */}
                    <div className="avoid-break flex border-b border-gray-200 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                      <div className="w-24">שעה</div>
                      <div className="flex-1">פעילות</div>
                      <div className="w-48">מיקום</div>
                      <div className="w-24 text-center">כמות</div>
                    </div>

                    {/* Rows */}
                    <div className="flex-1">
                      <div className="space-y-1">
                        {day.events.map((ev, i) => {
                          const isLastRow = i === day.events.length - 1;

                          return (
                            <div
                              key={`${idx}-${i}`}
                              className={`row flex items-start py-4 ${!isLastRow ? 'border-b border-gray-100' : ''}`}
                            >
                              {/* Time */}
                              <div className="w-24 mono text-sm font-bold text-slate-500 pt-1">
                                {ev.startTime || '--:--'}
                              </div>

                              {/* Activity */}
                              <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg font-bold text-slate-900 leading-none">
                                    {ev.title || 'ללא כותרת'}
                                  </span>

                                  {ev.kosherType && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold border
                                        ${
                                          ev.kosherType === 'meat'
                                            ? 'bg-red-50 text-red-600 border-red-100'
                                            : ev.kosherType === 'halavi'
                                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                                            : 'bg-green-50 text-green-600 border-green-100'
                                        }`}
                                    >
                                      {ev.kosherType === 'meat'
                                        ? 'בשרי'
                                        : ev.kosherType === 'halavi'
                                        ? 'חלבי'
                                        : 'פרווה'}
                                    </span>
                                  )}
                                </div>

                                {ev._smartDetail ? (
                                  <div className="text-sm text-slate-700">
                                    <span className="font-semibold">{ev._smartDetail}</span>
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-400">—</div>
                                )}

                                {(ev.requirements || ev.notes) && (
                                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded inline-block max-w-full">
                                    {ev.requirements || ev.notes}
                                  </div>
                                )}
                              </div>

                              {/* Location */}
                              <div className="w-48 text-sm font-medium text-slate-600 pt-1 flex items-start gap-1.5">
                                {(ev.hall?.name || ev.locationText) && (
                                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                )}
                                {ev.hall?.name || ev.locationText || '-'}
                              </div>

                              {/* Pax */}
                              <div className="w-24 text-center pt-1">
                                {ev._pax > 0 ? (
                                  <span className="inline-block bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[32px]">
                                    {ev._pax}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="avoid-break mt-auto pt-6 border-t border-gray-100 flex justify-between items-end text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                      <div>הופק ע"י המערכת • {new Date().toLocaleDateString('he-IL')}</div>
                      <div>
                        עמוד {pageNo} מתוך {totalPages} • {group.name}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>,
          printRoot
        )}
    </>
  );
}
