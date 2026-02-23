import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Users, MapPin, Info } from 'lucide-react';
import { MEAL_LABELS, heDate, KosherBadge, getKosherMeta, cx } from './kitchenUtils';

function LoadingPlaceholder() {
  return (
    <div className="space-y-3 py-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse print:shadow-none" />
      ))}
    </div>
  );
}

export default function KitchenScreenView({ 
  loading, 
  hasAnyData, 
  viewMode, 
  weekDays, 
  dailyMap, 
  groupMap 
}) {
  return (
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

      {/* --- תצוגה יומית במסך --- */}
      {!loading && viewMode === 'daily' && hasAnyData && (
        <div className="space-y-8">
          {weekDays.map((dayDate) => {
            const dateKey = dayDate.toDateString();
            const dayEvents = dailyMap[dateKey] || [];
            if (!dayEvents.length) return null;

            const dayPax = dayEvents.reduce((acc, e) => acc + Number(e?.pax || 0), 0);

            return (
              <section key={dateKey} className="break-inside-avoid page-break-inside-avoid">
                {/* כותרת יום */}
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

                {/* כרטיסי אירועים */}
                <div className="grid gap-3">
                  {dayEvents.map((event, idx) => {
                    const kosherMeta = getKosherMeta(event.kosherType);
                    let barColor = 'bg-slate-300';
                    if (kosherMeta?.tone === 'meat') barColor = 'bg-red-400';
                    if (kosherMeta?.tone === 'parve') barColor = 'bg-emerald-400';
                    if (kosherMeta?.tone === 'dairy') barColor = 'bg-blue-400';

                    const mealLabel = event.mealId?.name || MEAL_LABELS[event.mealType] || event.title || 'אירוע';
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
                                
                                <div className="mt-1.5 text-sm font-bold text-slate-800 bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100">
                                    🍽️ {event.smartMenu}
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

                          {(event.requirements || event.notes) && (
                            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 font-semibold flex items-start gap-2">
                              <Info size={16} className="shrink-0 mt-0.5" />
                              <div className="whitespace-pre-wrap">{event.requirements || event.notes}</div>
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

      {/* --- תצוגה קבוצתית במסך --- */}
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
                            const mealLabel = ev.mealId?.name || MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                            const loc = ev.hall?.name || ev.locationText || '---';
                            return (
                              <tr
                                key={i}
                                className={cx('border-t border-slate-200', i % 2 === 1 && 'bg-slate-50/50')}
                              >
                                <td className="py-2 px-3 font-bold">
                                  {format(new Date(ev.date), 'dd/MM', { locale: he })}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-extrabold">{mealLabel}</span>
                                    <KosherBadge kosherType={ev.kosherType} />
                                  </div>
                                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                                    {ev.smartMenu}
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
  );
}