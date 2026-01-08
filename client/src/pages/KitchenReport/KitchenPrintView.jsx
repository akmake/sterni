import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Utensils } from 'lucide-react';
import { MEAL_LABELS, heDate, getKosherMeta } from './kitchenUtils'; // וודא נתיב

export default function KitchenPrintView({ 
  loading, 
  hasAnyData, 
  viewMode, 
  weekRangeText, 
  dailyMap, 
  weekDays, 
  groupMap 
}) {
  return (
    <div className="print-only">
      <div className="border-b pb-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Utensils className="text-black" />
            <div>
              <div className="text-xl font-black">דוח מטבח </div>
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

      {/* --- תצוגה יומית בהדפסה --- */}
      {!loading && hasAnyData && viewMode === 'daily' && (
        <div className="space-y-6">
          {weekDays.map((dayDate) => {
            const dateKey = dayDate.toDateString();
            const rawEvents = dailyMap[dateKey] || [];
            
            if (!rawEvents.length) return null;

            // 👇 התיקון: מיון כפוי לפי שעות כאן ועכשיו
            const dayEvents = [...rawEvents].sort((a, b) => {
                // משתמש בערך המיון מההורה אם קיים, או משווה שעות (מחרוזת) כגיבוי
                if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
                    return a.sortValue - b.sortValue;
                }
                return (a.startTime || '').localeCompare(b.startTime || '');
            });

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
                      <th className="border border-slate-400 p-1 text-right w-[130px]">סוג ארוחה</th>
                      <th className="border border-slate-400 p-1 text-right">תפריט</th>
                      <th className="border border-slate-400 p-1 text-right w-[130px]">מיקום</th>
                      <th className="border border-slate-400 p-1 text-right w-[62px]">סועדים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEvents.map((ev, i) => {
                      const mealLabel = MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                      const loc = ev.hall?.name || ev.locationText || '---';
                      const kosher = getKosherMeta(ev.kosherType)?.label || '';
                      
                      return (
                        <tr key={i}>
                          <td className="border border-slate-400 p-1 font-bold">
                            {String(ev.startTime || '')}-{String(ev.endTime || '')}
                          </td>
                          <td className="border border-slate-400 p-1">
                            {mealLabel}
                            {kosher ? ` (${kosher})` : ''}
                          </td>
                          <td className="border border-slate-400 p-1 whitespace-pre-wrap font-bold">
                            {ev.smartMenu}
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

      {/* --- תצוגה קבוצתית בהדפסה --- */}
      {!loading && hasAnyData && viewMode === 'groups' && (
        <div className="space-y-6">
          {Object.keys(groupMap)
            .sort((a, b) => (groupMap[b]?.totalPax || 0) - (groupMap[a]?.totalPax || 0))
            .map((groupName) => {
              const g = groupMap[groupName];
              
              // מיון אירועי הקבוצה לפי שעות
              const groupEvents = [...g.events].sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  if (dateA !== dateB) return dateA - dateB;
                  
                  if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
                      return a.sortValue - b.sortValue;
                  }
                  return (a.startTime || '').localeCompare(b.startTime || '');
              });

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
                      {groupEvents.map((ev, i) => {
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
                              <div>
                                  {mealLabel} {kosher ? ` (${kosher})` : ''}
                              </div>
                              <div className="font-bold mt-0.5">{ev.smartMenu}</div>
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
  );
}