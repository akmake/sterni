import React, { useEffect, useMemo, useState } from 'react';
import useGroupsStore from '@/stores/groupsStore';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarDays, Printer, ArrowRight, ArrowLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import PrintableSchedule from '@/components/reports/PrintableSchedule'; // וודא שהנתיב נכון

// --- Helpers ---
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
  const isMeal = Boolean(event.isMeal) || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
  const smartDetail = isMeal
    ? getSmartMenuName(event)
    : (event.description || event.requirements || event.notes || '');
  const pax = Number(event.pax || 0);

  // הוספת שעת סיום אם חסרה (לצורך תצוגה בלבד)
  const startTime = event.startTime || '00:00';
  let endTime = event.endTime || ''; 
  // לוגיקה פשוטה להשלמת שעת סיום אם אין, אפשר לשפר
  if (!endTime && event.end) {
     try {
       endTime = format(new Date(event.end), 'HH:mm');
     } catch (e) { /* ignore */ }
  }

  return {
    ...event,
    startTime,
    endTime, 
    _isMeal: isMeal,
    _smartDetail: smartDetail,
    _pax: Number.isFinite(pax) ? pax : 0,
  };
}

// פונקציה למיון אירועים לפי "יום עסקים" (06:00 - 06:00)
const getBusinessDaySortValue = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 6) {
        return (hours + 24) * 60 + minutes;
    }
    return hours * 60 + minutes;
};

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

  // --- עיבוד נתונים: קבוצות -> ימים -> אירועים ---
  const processedData = useMemo(() => {
    let targetGroups = groups || [];
    if (selectedGroupId !== 'all') {
      targetGroups = targetGroups.filter((g) => g._id === selectedGroupId);
    }

    const result = [];

    targetGroups.forEach((group) => {
      const schedule = group.schedule || [];
      const daysMap = new Map();

      schedule.forEach((event) => {
        if (!event?.date) return;

        let eventDate = parseISO(event.date);

        // --- Business Day Logic ---
        const [hRaw] = String(event.startTime || '00:00').split(':');
        if (Number(hRaw) < 6) {
             eventDate = subDays(eventDate, 1);
        }

        if (eventDate >= currentWeekStart && eventDate <= weekEnd) {
          const dayKey = format(eventDate, 'yyyy-MM-dd');
          if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, { dateObj: eventDate, events: [] });
          }
          daysMap.get(dayKey).events.push(normalizeEventToRow(event));
        }
      });

      // מיון ימים ומיון אירועים בתוך כל יום
      const days = Array.from(daysMap.values())
        .sort((a, b) => a.dateObj - b.dateObj)
        .map((day) => ({
          ...day,
          events: (day.events || []).slice().sort((a, b) => {
            // מיון משופר: לילה בסוף
            return getBusinessDaySortValue(a.startTime) - getBusinessDaySortValue(b.startTime);
          }),
        }));

      if (days.length > 0) {
        result.push({ ...group, days });
      }
    });

    return result;
  }, [groups, currentWeekStart, weekEnd, selectedGroupId]);

  // השטחת הנתונים לדפים לצורך הדפסה
  const printPages = useMemo(() => {
    const pages = [];
    processedData.forEach((group) => {
      group.days.forEach((day) => pages.push({ group, day }));
    });
    return pages;
  }, [processedData]);

  const weekLabel = `${heDate(currentWeekStart)} - ${heDate(weekEnd)}`;

  const onPrint = () => {
    document.documentElement.classList.add('print-mode');
    window.print();
    setTimeout(() => document.documentElement.classList.remove('print-mode'), 2000);
  };

  return (
    <>
      {/* --- תצוגת מסך (Screen UI) --- */}
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
                            {/* שינוי כאן: קודם סיום ואז התחלה */}
                            <span className="mono text-[10px] bg-white px-1 rounded border border-gray-200 whitespace-nowrap">
                              {ev.endTime || '??'} - {ev.startTime}
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
              להדפסה נקייה: לחץ "הדפס" — ההדפסה מתבצעת כמסמך A4 אמיתי.
            </div>
          )}
        </div>
      </div>

      {/* --- רכיב ההדפסה המופרד --- */}
      <PrintableSchedule 
        printPages={printPages} 
        weekLabel={weekLabel} 
      />
    </>
  );
}