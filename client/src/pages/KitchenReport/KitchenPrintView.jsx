import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Utensils } from 'lucide-react';
// יש לוודא שהייבוא הזה תואם את מבנה הפרויקט שלך
import { MEAL_LABELS, heDate, getKosherMeta } from './kitchenUtils';

export default function KitchenPrintView({
  loading,
  hasAnyData,
  viewMode,     // 'daily' או 'groups'
  weekRangeText,
  dailyMap,     // אובייקט המכיל את האירועים לפי תאריך
  weekDays,     // מערך של ימי השבוע
  groupMap,     // אובייקט המכיל את האירועים לפי קבוצה
}) {

  // פונקציית עזר לסידור הערות בשורה אחת למניעת התנפחות לגובה
  const renderNotes = (ev) => {
    const text = ev.requirements || ev.notes || '';
    if (!text) return '';
    return text.toString().replace(/\n/g, ', ');
  };

  return (
    <div className="print-only">
      {/* === CSS MAGIC FOR PAGINATION === 
          כאן מתרחש הקסם של שבירת העמודים האוטומטית
      */}
      <style>{`
        @media print {
          /* איפוסים קריטיים להדפסה */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }

          #root, #__next, .app, .layout, .page, .print-only {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
          }

          /* הגדרת שוליים לדף הפיזי */
          @page {
            margin: 10mm 10mm 10mm 10mm;
            size: A4 portrait;
          }

          /* --- מנגנון הטבלה החכמה --- */
          
          /* 1. הטבלה יכולה להישבר בין עמודים */
          table {
            width: 100%;
            border-collapse: collapse;
            break-inside: auto !important; 
            page-break-inside: auto !important;
          }

          /* 2. שורת טבלה לעולם לא תיחתך באמצע! או שהיא בדף 1 או בדף 2 */
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* 3. הקסם: הכותרות (thead) יודפסו מחדש בתחילת כל עמוד נוסף */
          thead {
            display: table-header-group !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          /* --- סקשנים וכותרות --- */
          
          /* סקשן (כמו יום או קבוצה) יכול להישבר */
          .print-section {
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 2rem;
            display: block; /* חשוב מאוד כדי שה-break יעבוד */
          }

          /* אבל הכותרת של הסקשן צריכה להיצמד לתוכן שלה */
          .print-section-header {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          
          /* הסתרת אלמנטים לא רלוונטיים */
          .no-print { display: none !important; }
        }
      `}</style>

      {/* --- כותרת ראשית של הדוח --- */}
      <div className="border-b pb-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Utensils className="text-black w-8 h-8" />
            <div>
              <div className="text-2xl font-black">דוח מטבח מרוכז</div>
              <div className="text-sm font-semibold text-slate-600">שבוע: {weekRangeText}</div>
              <div className="text-xs text-slate-500 mt-1">יום עסקים מחושב: 06:00 עד 06:00 למחרת</div>
            </div>
          </div>
          <div className="text-xs text-left text-slate-500">
            הופק בתאריך: {new Date().toLocaleDateString('he-IL')} <br/>
            בשעה: {new Date().toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>

      {!loading && !hasAnyData && (
        <div className="text-center py-10 text-slate-500">אין נתונים להצגה בשבוע זה.</div>
      )}

      {/* --- מצב תצוגה: יומי (Daily View) --- */}
      {!loading && hasAnyData && viewMode === 'daily' && (
        <div className="flex flex-col gap-6">
          {weekDays.map((dayDate) => {
            const dateKey = dayDate.toDateString();
            const rawEvents = dailyMap[dateKey] || [];
            if (!rawEvents.length) return null;

            // מיון האירועים לפי זמן
            const dayEvents = [...rawEvents].sort((a, b) => {
              if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
                return a.sortValue - b.sortValue;
              }
              return (a.startTime || '').localeCompare(b.startTime || '');
            });

            return (
              <div key={dateKey} className="print-section">
                {/* כותרת היום - לא תישאר לבד בסוף עמוד בזכות break-after: avoid */}
                <div className="print-section-header bg-slate-100 p-2 rounded-t border border-slate-300 border-b-0 flex justify-between items-baseline mb-0">
                  <div className="text-lg font-black text-slate-900">
                    {format(dayDate, 'EEEE', { locale: he })} — {heDate(dayDate)}
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    סה"כ אירועים: {dayEvents.length}
                  </div>
                </div>

                <table className="w-full text-[11px] border-collapse table-fixed border border-slate-300">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="border border-slate-300 p-1.5 text-right w-[60px]">שעה</th>
                      <th className="border border-slate-300 p-1.5 text-right w-[90px]">ארוחה</th>
                      <th className="border border-slate-300 p-1.5 text-right w-[110px]">קבוצה</th>
                      <th className="border border-slate-300 p-1.5 text-right w-[180px]">תפריט</th>
                      <th className="border border-slate-300 p-1.5 text-right w-[90px]">מיקום</th>
                      <th className="border border-slate-300 p-1.5 text-center w-[40px]">פוקס</th>
                      <th className="border border-slate-300 p-1.5 text-right">הערות/דרישות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEvents.map((ev, i) => {
                      const mealLabel = ev.mealId?.name || MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                      const loc = ev.hall?.name || ev.locationText || '-';
                      const kosherMeta = getKosherMeta(ev.kosherType);
                      const kosherLabel = kosherMeta?.label || '';
                      
                      // צביעת שורה לפי כשרות (אופציונלי ועדין)
                      const rowClass = kosherMeta?.color === 'red' ? 'bg-red-50/30' : 
                                     kosherMeta?.color === 'blue' ? 'bg-blue-50/30' : '';

                      return (
                        <tr key={`${dateKey}-${i}`} className={rowClass}>
                          <td className="border border-slate-300 p-1.5 font-bold text-center align-top">
                            {ev.startTime ? `${ev.startTime}-${ev.endTime}` : '??:??'}
                          </td>
                          <td className="border border-slate-300 p-1.5 align-top">
                            <span className="font-bold">{mealLabel}</span>
                            {kosherLabel && <span className="text-[10px] block text-slate-500">{kosherLabel}</span>}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-bold text-blue-900 align-top truncate">
                            {ev.groupName || '-'}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-medium whitespace-pre-wrap align-top">
                            {ev.smartMenu || '-'}
                          </td>
                          <td className="border border-slate-300 p-1.5 align-top truncate">{loc}</td>
                          <td className="border border-slate-300 p-1.5 font-black text-center align-top text-sm">
                            {ev.pax || 0}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-xs text-gray-700 align-top">
                            {renderNotes(ev)}
                          </td>
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

      {/* --- מצב תצוגה: קבוצות (Groups View) --- */}
      {!loading && hasAnyData && viewMode === 'groups' && (
        <div className="flex flex-col gap-8">
          {Object.keys(groupMap)
            .sort((a, b) => (groupMap[b]?.totalPax || 0) - (groupMap[a]?.totalPax || 0))
            .map((groupName) => {
              const g = groupMap[groupName];
              // מיון אירועי הקבוצה לפי תאריך ואז שעה
              const groupEvents = [...g.events].sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return (a.startTime || '').localeCompare(b.startTime || '');
              });

              return (
                <div key={groupName} className="print-section">
                  <div className="print-section-header mb-2 border-b-2 border-slate-800 pb-1 flex justify-between items-end">
                    <h2 className="text-xl font-black text-slate-900">{groupName}</h2>
                    <span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-full">
                      סה"כ סועדים בשבוע: {g.totalPax}
                    </span>
                  </div>

                  <table className="w-full text-[11px] border-collapse table-fixed border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 p-1.5 text-right w-[50px]">תאריך</th>
                        <th className="border border-slate-300 p-1.5 text-right w-[60px]">שעה</th>
                        <th className="border border-slate-300 p-1.5 text-right w-[100px]">ארוחה</th>
                        <th className="border border-slate-300 p-1.5 text-right w-[160px]">תפריט</th>
                        <th className="border border-slate-300 p-1.5 text-right w-[90px]">מיקום</th>
                        <th className="border border-slate-300 p-1.5 text-center w-[40px]">כמות</th>
                        <th className="border border-slate-300 p-1.5 text-right">הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEvents.map((ev, i) => {
                        const mealLabel = ev.mealId?.name || MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                        const loc = ev.hall?.name || ev.locationText || '-';
                        const kosher = getKosherMeta(ev.kosherType)?.label || '';

                        return (
                          <tr key={i}>
                            <td className="border border-slate-300 p-1.5 font-bold">
                              {format(new Date(ev.date), 'dd/MM', { locale: he })}
                            </td>
                            <td className="border border-slate-300 p-1.5 text-center">
                              {ev.startTime}-{ev.endTime}
                            </td>
                            <td className="border border-slate-300 p-1.5">
                              {mealLabel} {kosher ? `(${kosher})` : ''}
                            </td>
                            <td className="border border-slate-300 p-1.5 font-medium">{ev.smartMenu}</td>
                            <td className="border border-slate-300 p-1.5 truncate">{loc}</td>
                            <td className="border border-slate-300 p-1.5 font-bold text-center">
                              {ev.pax || 0}
                            </td>
                            <td className="border border-slate-300 p-1.5 text-xs text-gray-600">
                              {renderNotes(ev)}
                            </td>
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

      {/* --- Footer שמופיע בסוף --- */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
        מערכת ניהול - דהאן פתרונות טכנולוגים לעסקים
      </div>
    </div>
  );
}