import React from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Users, MapPin, Info } from 'lucide-react';
import { usePrintPortalRoot } from '@/hooks/usePrintPortalRoot'; // וודא שהנתיב נכון

export default function PrintableSchedule({ printPages, weekLabel }) {
  const printRoot = usePrintPortalRoot();

  if (!printRoot) return null;

  return createPortal(
    <div className="print-doc">
      {/* --- CSS להדפסה בלבד --- */}
      <style>{`
        #print-root { display: none; }
        @media print {
          #root { display: none !important; }
          #print-root { display: block !important; }
          @page {
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
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
          .print-doc {
            direction: rtl;
            color: #0f172a;
            font-family: Assistant, system-ui, sans-serif;
          }
          .day-page {
            box-sizing: border-box;
            min-height: calc(297mm - 30mm); /* גובה A4 פחות שוליים */
            display: flex;
            flex-direction: column;
            break-after: page;
            page-break-after: always;
          }
          .day-page.is-last {
            break-after: auto;
            page-break-after: auto;
          }
          .avoid-break, .row {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-title { letter-spacing: -0.02em; }
          .mono { font-family: ui-monospace, monospace; }
        }
      `}</style>

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
              key={`${group._id}-${format(day.dateObj, 'yyyy-MM-dd')}-${idx}`}
              className={`day-page ${isLast ? 'is-last' : ''}`}
            >
              {/* --- כותרת הדף (Header) --- */}
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

              {/* --- כותרות הטבלה --- */}
              <div className="avoid-break flex border-b border-gray-200 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                <div className="w-32">שעות</div>
                <div className="flex-1">פעילות</div>
                <div className="w-48">מיקום</div>
                <div className="w-24 text-center">כמות</div>
              </div>

              {/* --- שורות הטבלה (Events) --- */}
              <div className="flex-1">
                <div className="space-y-1">
                  {day.events.map((ev, i) => {
                    const isLastRow = i === day.events.length - 1;

                    // --- התיקון למניעת כפילות ---
                    const noteText = ev.requirements || ev.notes;
                    // מציג הערה רק אם היא קיימת וגם לא מופיעה כבר בתוך הפירוט החכם
                    const shouldShowNote = noteText && (!ev._smartDetail || !ev._smartDetail.includes(noteText));

                    return (
                      <div
                        key={`${idx}-${i}`}
                        className={`row flex items-start py-4 ${!isLastRow ? 'border-b border-gray-100' : ''}`}
                      >
                        {/* עמודת זמנים */}
                        <div className="w-32 mono text-sm font-bold text-slate-500 pt-1 whitespace-nowrap">
                          {ev.endTime || '--:--'} - {ev.startTime || '--:--'}
                        </div>

                        {/* עמודת פעילות */}
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-slate-900 leading-none">
                              {ev.title || 'ללא כותרת'}
                            </span>
                            {ev.kosherType && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold border
                                  ${ev.kosherType === 'meat' ? 'bg-red-50 text-red-600 border-red-100' :
                                    ev.kosherType === 'halavi' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-green-50 text-green-600 border-green-100'}`}
                              >
                                {ev.kosherType === 'meat' ? 'בשרי' : ev.kosherType === 'halavi' ? 'חלבי' : 'פרווה'}
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

                          {/* הצגת הריבוע האפור רק אם צריך */}
                          {shouldShowNote && (
                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded inline-block max-w-full whitespace-pre-wrap">
                              {noteText}
                            </div>
                          )}
                        </div>

                        {/* עמודת מיקום */}
                        <div className="w-48 text-sm font-medium text-slate-600 pt-1 flex items-start gap-1.5">
                          {(ev.hall?.name || ev.locationText) && (
                            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          )}
                          {ev.hall?.name || ev.locationText || '-'}
                        </div>

                        {/* עמודת כמות */}
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

              {/* --- Footer --- */}
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
  );
}