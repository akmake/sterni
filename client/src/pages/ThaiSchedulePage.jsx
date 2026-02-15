// client/src/pages/ThaiSchedulePage.jsx
// -------------------------------------------------------
// דף לו"ז בתאילנדית לעובדי המטבח
// -------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import useGroupsStore from '@/stores/groupsStore';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  parseISO,
  isWithinInterval,
  eachDayOfInterval,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { he } from 'date-fns/locale';
import {
  CalendarDays,
  Printer,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Clock,
  MapPin,
  Users,
  ChefHat,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePrintPortalRoot } from '@/hooks/usePrintPortalRoot';
import { createPortal } from 'react-dom';

// ====================================================================
// מילון עברית → תאילנדית
// ====================================================================
const THAI = {
  // ימים בשבוע
  days: {
    'ראשון': 'วันอาทิตย์',
    'שני': 'วันจันทร์',
    'שלישי': 'วันอังคาร',
    'רביעי': 'วันพุธ',
    'חמישי': 'วันพฤหัสบดี',
    'שישי': 'วันศุกร์',
    'שבת': 'วันเสาร์',
  },

  // סוג ארוחה
  mealTypes: {
    'breakfast': 'อาหารเช้า',       // ארוחת בוקר
    'lunch': 'อาหารกลางวัน',        // ארוחת צהריים
    'dinner': 'อาหารเย็น',          // ארוחת ערב
    'light_meal': 'อาหารว่าง',      // ארוחה קלה
    'light_evening': 'อาหารว่างเย็น', // ארוחה קלה ערב
    'night_treats': 'ของว่างกลางคืน', // פינוקי לילה
  },

  // כשרות
  kosherTypes: {
    'meat': 'เนื้อสัตว์',     // בשרי
    'halavi': 'นม',           // חלבי
    'parve': 'ปาร์เว',        // פרווה
  },

  // סוג אירוע
  eventTypes: {
    'meal': 'มื้ออาหาร',      // ארוחה
    'activity': 'กิจกรรม',    // פעילות
    'meeting': 'ประชุม',      // פגישה
    'setup': 'การเตรียมการ',  // הכנות
    'other': 'อื่นๆ',        // אחר
  },

  // כללי
  ui: {
    schedule: 'ตารางงาน',          // לו"ז
    dailySchedule: 'ตารางงานประจำวัน', // לו"ז יומי
    time: 'เวลา',                   // שעה
    event: 'กิจกรรม',               // אירוע
    location: 'สถานที่',            // מיקום
    quantity: 'จำนวน',              // כמות
    people: 'คน',                   // אנשים
    notes: 'หมายเหตุ',              // הערות
    page: 'หน้า',                   // עמוד
    of: 'จาก',                      // מתוך
    noEvents: 'ไม่มีกิจกรรม',       // אין אירועים
    print: 'พิมพ์',                 // הדפס
    selectAll: 'เลือกทั้งหมด',      // בחר הכל
    deselectAll: 'ยกเลิกทั้งหมด',   // בטל הכל
    workSchedule: 'ตารางการทำงาน',   // סדר עבודה
    kitchen: 'ครัว',                 // מטבח
    portions: 'จาน',                // מנות
  },
};

// תרגום יום בשבוע מ-date-fns עברית לתאילנדית
function getThaiDayName(dateObj) {
  const heDayName = format(dateObj, 'EEEE', { locale: he });
  return THAI.days[heDayName] || format(dateObj, 'EEEE', { locale: th });
}

function getThaiMealType(mealType) {
  return THAI.mealTypes[mealType] || mealType || '';
}

function getThaiKosherType(kosherType) {
  return THAI.kosherTypes[kosherType] || kosherType || '';
}

function getThaiEventType(eventType) {
  return THAI.eventTypes[eventType] || eventType || '';
}

// ====================================================================
// לוגיקה עסקית (06:00 → 06:00)
// ====================================================================
const getBusinessDaySortValue = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (hours < 6) return (hours + 24) * 60 + minutes;
  return hours * 60 + minutes;
};

function normalizeEventToRow(event) {
  const isMeal =
    Boolean(event.isMeal) ||
    event.eventType === 'meal' ||
    (event.mealType && event.mealType !== 'regular');
  const pax = Number(event.pax || 0);
  return {
    ...event,
    startTime: event.startTime || '00:00',
    endTime: event.endTime || '',
    _isMeal: isMeal,
    _pax: Number.isFinite(pax) ? pax : 0,
  };
}

// ====================================================================
// רכיב ההדפסה בתאילנדית (Portal)
// ====================================================================
function ThaiPrintableSchedule({ printPages }) {
  const printRoot = usePrintPortalRoot();
  if (!printRoot || printPages.length === 0) return null;

  return createPortal(
    <div className="print-doc-thai">
      <style>{`
        /* ─── Google Font for Thai ─── */
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');

        #print-root-thai { display: none; }

        @media print {
          #root { display: none !important; }
          #print-root { display: none !important; }
          #print-root-thai { display: block !important; }

          @page {
            size: A4 portrait;
            margin: 12mm 12mm 14mm 12mm;
          }
          html, body {
            background: #fff !important;
            height: auto !important;
            overflow: visible !important;
          }
          .print-mode body, .print-mode html {
            height: auto !important;
            overflow: visible !important;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-doc-thai {
            direction: ltr;
            color: #1a1a2e;
            font-family: 'Sarabun', 'Noto Sans Thai', system-ui, sans-serif;
          }

          .thai-page {
            box-sizing: border-box;
            min-height: calc(297mm - 26mm);
            display: flex;
            flex-direction: column;
            break-after: page;
            page-break-after: always;
          }
          .thai-page.is-last {
            break-after: auto;
            page-break-after: auto;
          }
          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* ─── Custom styles ─── */
          .thai-header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .thai-day-label {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .thai-date-label {
            font-size: 14px;
            font-weight: 400;
            opacity: 0.7;
          }

          .thai-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 13px;
          }
          .thai-table thead th {
            background: #f0f4ff;
            color: #3a3d5c;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 10px 12px;
            text-align: left;
            border-bottom: 2px solid #d0d5e8;
          }
          .thai-table thead th:first-child { border-radius: 8px 0 0 0; }
          .thai-table thead th:last-child { border-radius: 0 8px 0 0; }

          .thai-table tbody tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .thai-table tbody td {
            padding: 10px 12px;
            border-bottom: 1px solid #eef0f6;
            vertical-align: top;
          }
          .thai-table tbody tr:last-child td {
            border-bottom: none;
          }

          .thai-time {
            font-family: 'Sarabun', monospace;
            font-weight: 700;
            font-size: 15px;
            color: #1a1a2e;
            white-space: nowrap;
          }
          .thai-event-title {
            font-weight: 700;
            font-size: 15px;
            color: #1a1a2e;
            margin-bottom: 2px;
          }
          .thai-event-detail {
            font-size: 12px;
            color: #6b7194;
            line-height: 1.5;
          }
          .thai-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            margin-left: 6px;
            vertical-align: middle;
          }
          .badge-meat { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
          .badge-dairy { background: #dbeafe; color: #2563eb; border: 1px solid #bfdbfe; }
          .badge-parve { background: #d1fae5; color: #059669; border: 1px solid #a7f3d0; }
          .badge-meal { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
          .badge-activity { background: #ede9fe; color: #7c3aed; border: 1px solid #ddd6fe; }

          .thai-pax {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #1a1a2e;
            color: white;
            font-size: 12px;
            font-weight: 700;
            min-width: 28px;
            height: 24px;
            border-radius: 12px;
            padding: 0 8px;
          }

          .thai-notes-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 11px;
            color: #475569;
            margin-top: 4px;
            white-space: pre-wrap;
          }

          .thai-footer {
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94a3b8;
            letter-spacing: 0.05em;
          }

          .thai-summary-bar {
            display: flex;
            gap: 12px;
            margin-top: 8px;
          }
          .thai-summary-item {
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(255,255,255,0.15);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
          }
        }
      `}</style>

      {printPages.map(({ dayObj, events, groupName, dayLabel, dateLabel, daySummary }, idx) => {
        const isLast = idx === printPages.length - 1;
        const pageNo = idx + 1;
        const totalPages = printPages.length;

        return (
          <div key={idx} className={`thai-page ${isLast ? 'is-last' : ''}`}>
            {/* ─── Header ─── */}
            <div className="thai-header avoid-break">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="thai-day-label">{dayLabel}</div>
                  <div className="thai-date-label">{dateLabel}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>
                    {THAI.ui.workSchedule}
                  </div>
                  <div className="thai-summary-bar">
                    {daySummary.totalPax > 0 && (
                      <div className="thai-summary-item">
                        <span>{THAI.ui.quantity}:</span>
                        <span style={{ fontWeight: 700 }}>{daySummary.totalPax} {THAI.ui.people}</span>
                      </div>
                    )}
                    {daySummary.totalEvents > 0 && (
                      <div className="thai-summary-item">
                        <span>{THAI.ui.event}:</span>
                        <span style={{ fontWeight: 700 }}>{daySummary.totalEvents}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Table ─── */}
            <table className="thai-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>{THAI.ui.time}</th>
                  <th>{THAI.ui.event}</th>
                  <th style={{ width: '130px' }}>{THAI.ui.location}</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>{THAI.ui.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const noteText = ev.requirements || ev.notes;
                  const thaiMeal = getThaiMealType(ev.mealType);
                  const thaiKosher = getThaiKosherType(ev.kosherType);
                  const thaiEventType = getThaiEventType(ev.eventType);
                  const hallName = ev.hall?.name || ev.locationText || '-';

                  return (
                    <tr key={i} className="avoid-break">
                      {/* שעה */}
                      <td>
                        <div className="thai-time">
                          {ev.startTime || '--:--'}
                        </div>
                        {ev.endTime && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            → {ev.endTime}
                          </div>
                        )}
                      </td>

                      {/* אירוע */}
                      <td>
                        <div className="thai-event-title">
                          {ev.title || '-'}
                          {ev.kosherType && (
                            <span className={`thai-badge ${
                              ev.kosherType === 'meat' ? 'badge-meat' :
                              ev.kosherType === 'halavi' ? 'badge-dairy' :
                              'badge-parve'
                            }`}>
                              {thaiKosher}
                            </span>
                          )}
                          {ev._isMeal && (
                            <span className="thai-badge badge-meal">
                              {thaiMeal || THAI.eventTypes.meal}
                            </span>
                          )}
                        </div>

                        <div className="thai-event-detail">
                          {groupName && <span>{groupName}</span>}
                          {ev._smartDetail && <span> • {ev._smartDetail}</span>}
                        </div>

                        {noteText && (
                          <div className="thai-notes-box">
                            {THAI.ui.notes}: {noteText}
                          </div>
                        )}
                      </td>

                      {/* מיקום */}
                      <td style={{ fontSize: '13px', color: '#3a3d5c' }}>
                        {hallName}
                      </td>

                      {/* כמות */}
                      <td style={{ textAlign: 'center' }}>
                        {ev._pax > 0 ? (
                          <span className="thai-pax">{ev._pax}</span>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ─── Footer ─── */}
            <div className="thai-footer">
              <div>
                {THAI.ui.schedule} • {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div>
                {THAI.ui.page} {pageNo} {THAI.ui.of} {totalPages}
              </div>
            </div>
          </div>
        );
      })}
    </div>,
    (() => {
      let root = document.getElementById('print-root-thai');
      if (!root) {
        root = document.createElement('div');
        root.id = 'print-root-thai';
        document.body.appendChild(root);
      }
      return root;
    })()
  );
}

// ====================================================================
// דף ראשי – בחירת ימים + אירועים + הדפסה
// ====================================================================
export default function ThaiSchedulePage() {
  const { groups, fetchGroups, halls, fetchHalls } = useGroupsStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [deselectedEvents, setDeselectedEvents] = useState(new Set());
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const weekEnd = useMemo(
    () => endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
    [currentWeekStart]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGroups(), fetchHalls?.()].filter(Boolean)).finally(() =>
      setLoading(false)
    );
  }, [fetchGroups, fetchHalls]);

  // איפוס בחירה כשמשנים שבוע
  useEffect(() => {
    setSelectedDays(new Set());
    setDeselectedEvents(new Set());
    setShowPrintPreview(false);
  }, [currentWeekStart]);

  // ── ימות השבוע ──
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: weekEnd }),
    [currentWeekStart, weekEnd]
  );

  // ── כל האירועים לפי "business day" ──
  const eventsByBusinessDay = useMemo(() => {
    const map = new Map(); // key = yyyy-MM-dd, value = [{ ...event, groupName, groupId }]

    (groups || []).forEach((group) => {
      (group.schedule || []).forEach((event) => {
        if (!event?.date) return;
        let eventDate = parseISO(event.date);
        const [hRaw] = String(event.startTime || '00:00').split(':');
        if (Number(hRaw) < 6) eventDate = subDays(eventDate, 1);

        if (isWithinInterval(eventDate, { start: currentWeekStart, end: weekEnd })) {
          const dayKey = format(eventDate, 'yyyy-MM-dd');
          if (!map.has(dayKey)) map.set(dayKey, []);
          map.get(dayKey).push({
            ...normalizeEventToRow(event),
            groupName: group.name,
            groupId: group._id,
          });
        }
      });
    });

    // מיון כרונולוגי בתוך כל יום
    for (const [key, events] of map.entries()) {
      events.sort(
        (a, b) =>
          getBusinessDaySortValue(a.startTime) -
          getBusinessDaySortValue(b.startTime)
      );
      map.set(key, events);
    }

    return map;
  }, [groups, currentWeekStart, weekEnd]);

  // ── Toggle functions ──
  const toggleDay = (dayKey) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  const selectAllDays = () => {
    const allKeys = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
    setSelectedDays(new Set(allKeys));
  };

  const deselectAllDays = () => {
    setSelectedDays(new Set());
  };

  const toggleEvent = (eventUniqueKey) => {
    setDeselectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventUniqueKey)) next.delete(eventUniqueKey);
      else next.add(eventUniqueKey);
      return next;
    });
  };

  // ── Unique event key ──
  const getEventKey = (dayKey, event, idx) =>
    `${dayKey}__${event.groupId || ''}__${event._id || idx}`;

  // ── נתונים שנבחרו להדפסה ──
  const selectedEventsForPrint = useMemo(() => {
    const pages = [];

    const sortedDayKeys = [...selectedDays].sort();

    sortedDayKeys.forEach((dayKey) => {
      const dayObj = parseISO(dayKey);
      const allEvents = eventsByBusinessDay.get(dayKey) || [];
      const filteredEvents = allEvents.filter(
        (ev, idx) => !deselectedEvents.has(getEventKey(dayKey, ev, idx))
      );

      if (filteredEvents.length === 0) return;

      const totalPax = filteredEvents.reduce((sum, e) => sum + (e._pax || 0), 0);

      pages.push({
        dayObj,
        events: filteredEvents,
        dayLabel: getThaiDayName(dayObj),
        dateLabel: format(dayObj, 'dd/MM/yyyy'),
        groupName: '', // mixed groups
        daySummary: {
          totalPax,
          totalEvents: filteredEvents.length,
        },
      });
    });

    return pages;
  }, [selectedDays, eventsByBusinessDay, deselectedEvents]);

  // ── Print ──
  const onPrint = () => {
    setShowPrintPreview(true);
    setTimeout(() => {
      document.documentElement.classList.add('print-mode');
      window.print();
      setTimeout(() => {
        document.documentElement.classList.remove('print-mode');
      }, 2000);
    }, 300);
  };

  const weekLabel = `${format(currentWeekStart, 'dd/MM/yyyy')} - ${format(weekEnd, 'dd/MM/yyyy')}`;

  // ====================================================================
  // Render
  // ====================================================================
  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 dir-rtl font-assistant pb-20 print:hidden">

        {/* ─── Sticky Header ─── */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2.5 rounded-xl shadow-md">
                <Globe className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  לו"ז לעובדים
                  <span className="text-sm font-normal bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 px-2 py-0.5 rounded-full">
                    🇹🇭 תאילנדית
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">{weekLabel}</p>
              </div>
            </div>

            {/* Navigation + Actions */}
            <div className="flex items-center gap-3">

              {/* Week nav */}
              <div className="flex bg-white border border-slate-200 rounded-xl p-1">
                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                  className="p-2 hover:bg-slate-50 rounded-lg transition"
                >
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() =>
                    setCurrentWeekStart(
                      startOfWeek(new Date(), { weekStartsOn: 0 })
                    )
                  }
                  className="px-3 text-sm font-bold text-orange-600 hover:bg-orange-50 rounded-lg transition"
                >
                  השבוע
                </button>
                <button
                  onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                  className="p-2 hover:bg-slate-50 rounded-lg transition"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>

              {/* Select All / None */}
              <button
                onClick={selectedDays.size > 0 ? deselectAllDays : selectAllDays}
                className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50 transition flex items-center gap-2"
              >
                {selectedDays.size > 0 ? (
                  <>
                    <Square size={14} /> נקה בחירה
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> בחר הכל
                  </>
                )}
              </button>

              {/* Print */}
              <Button
                onClick={onPrint}
                disabled={selectedEventsForPrint.length === 0}
                className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white rounded-xl h-10 px-6 gap-2 shadow-md disabled:opacity-40"
              >
                <Printer size={18} /> הדפס בתאילנדית
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="max-w-6xl mx-auto px-6 py-8">

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-500">טוען נתונים...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weekDays.map((dayObj) => {
                const dayKey = format(dayObj, 'yyyy-MM-dd');
                const events = eventsByBusinessDay.get(dayKey) || [];
                const isSelected = selectedDays.has(dayKey);
                const heDayName = format(dayObj, 'EEEE', { locale: he });
                const thaiDayName = getThaiDayName(dayObj);
                const hasEvents = events.length > 0;

                return (
                  <div
                    key={dayKey}
                    className={`rounded-2xl border-2 transition-all overflow-hidden ${
                      isSelected
                        ? 'border-orange-400 bg-white shadow-lg shadow-orange-100/50'
                        : hasEvents
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    {/* Day Header - clickable */}
                    <button
                      onClick={() => hasEvents && toggleDay(dayKey)}
                      disabled={!hasEvents}
                      className={`w-full px-5 py-3.5 flex items-center justify-between text-right transition ${
                        hasEvents ? 'cursor-pointer hover:bg-slate-50/50' : 'cursor-default opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox visual */}
                        <div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-orange-500 border-orange-500'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-800">{heDayName}</span>
                            <span className="text-sm text-orange-600 font-medium">{thaiDayName}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {format(dayObj, 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {hasEvents && (
                          <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">
                            {events.length} אירועים
                          </span>
                        )}
                        {!hasEvents && (
                          <span className="text-xs text-slate-400">אין אירועים</span>
                        )}
                      </div>
                    </button>

                    {/* Events list (show only when day is selected) */}
                    {isSelected && events.length > 0 && (
                      <div className="border-t border-orange-100 px-5 py-3 space-y-2 bg-orange-50/20">
                        {events.map((ev, idx) => {
                          const evKey = getEventKey(dayKey, ev, idx);
                          const isEventActive = !deselectedEvents.has(evKey);

                          return (
                            <button
                              key={evKey}
                              onClick={() => toggleEvent(evKey)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all ${
                                isEventActive
                                  ? 'bg-white border border-slate-100 shadow-sm'
                                  : 'bg-slate-50 border border-slate-100 opacity-50'
                              }`}
                            >
                              {/* Mini checkbox */}
                              <div
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  isEventActive
                                    ? 'bg-orange-500 border-orange-500'
                                    : 'border-slate-300'
                                }`}
                              >
                                {isEventActive && (
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>

                              {/* Time */}
                              <div className="text-sm font-mono font-bold text-slate-500 w-24 flex-shrink-0">
                                {ev.startTime}
                                {ev.endTime && <span className="text-slate-300"> → {ev.endTime}</span>}
                              </div>

                              {/* Title + Group */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-800 truncate">
                                    {ev.title || 'ללא כותרת'}
                                  </span>
                                  {ev.kosherType && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                        ev.kosherType === 'meat'
                                          ? 'bg-red-50 text-red-600'
                                          : ev.kosherType === 'halavi'
                                          ? 'bg-blue-50 text-blue-600'
                                          : 'bg-green-50 text-green-600'
                                      }`}
                                    >
                                      {ev.kosherType === 'meat' ? 'בשרי' : ev.kosherType === 'halavi' ? 'חלבי' : 'פרווה'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 truncate">
                                  {ev.groupName}
                                  {ev.hall?.name && ` • ${ev.hall.name}`}
                                </div>
                              </div>

                              {/* PAX */}
                              {ev._pax > 0 && (
                                <span className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                                  {ev._pax}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary bar */}
          {selectedEventsForPrint.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/30 flex items-center gap-6 z-50">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CalendarDays size={16} className="text-orange-400" />
                <span>{selectedEventsForPrint.length} ימים</span>
                <span className="text-slate-400 mx-1">•</span>
                <span>
                  {selectedEventsForPrint.reduce(
                    (sum, p) => sum + p.events.length,
                    0
                  )}{' '}
                  אירועים
                </span>
              </div>
              <Button
                onClick={onPrint}
                className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white rounded-xl px-6 h-9 text-sm font-bold shadow-md"
              >
                <Printer size={16} className="ml-2" />
                הדפס 🇹🇭
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Print portal ─── */}
      {showPrintPreview && (
        <ThaiPrintableSchedule printPages={selectedEventsForPrint} />
      )}
    </>
  );
}