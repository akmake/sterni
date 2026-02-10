import React from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChefHat, Calculator } from 'lucide-react';
import { usePrintPortalRoot } from '@/hooks/usePrintPortalRoot'; // שימוש ב-Hook הקיים שלך

export default function PrintableStaffSummary({ staffPages, dateRange }) {
  const printRoot = usePrintPortalRoot();

  if (!printRoot) return null;

  return createPortal(
    <div className="print-doc">
      {/* --- העתקה של ה-CSS המדויק מ-PrintableSchedule --- */}
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
            min-height: calc(297mm - 30mm);
            display: flex;
            flex-direction: column;
            break-after: page;
            page-break-after: always;
          }
          .day-page.is-last {
            break-after: auto;
            page-break-after: auto;
          }
          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-title { letter-spacing: -0.02em; }
        }
      `}</style>

      {staffPages.length === 0 ? (
        <div className="day-page is-last">
          <div className="text-2xl font-bold">אין נתונים להדפסה</div>
        </div>
      ) : (
        staffPages.map((workerData, idx) => {
          const isLast = idx === staffPages.length - 1;

          return (
            <div key={idx} className={`day-page ${isLast ? 'is-last' : ''}`}>
              
              {/* --- כותרת ראשית לעובד (בראש הדף) --- */}
              <div className="avoid-break border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="print-title text-4xl font-black text-slate-900 mb-2">
                      {workerData.name}
                    </h1>
                    <div className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                      <ChefHat size={16}/>
                      <span>סיכום ייצור יומי למטבח</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold text-slate-900">
                      טווח תאריכים
                    </div>
                    <div className="text-md font-medium text-slate-500 tracking-widest">
                       {format(new Date(dateRange.start), 'dd/MM')} - {format(new Date(dateRange.end), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- לולאה על הימים (קוביות שלא נשברות) --- */}
              <div className="flex-1 space-y-6">
                {workerData.days.map((day, dIdx) => (
                  <div key={dIdx} className="avoid-break border rounded-xl border-slate-200 overflow-hidden">
                    
                    {/* כותרת היום */}
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-800">
                          {format(day.dateObj, 'EEEE', { locale: he })}
                        </span>
                        <span className="text-lg text-slate-500 font-medium">
                          {format(day.dateObj, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="bg-slate-900 text-white px-3 py-1 rounded text-sm font-bold">
                        סה"כ: {day.totals.total} מנות
                      </div>
                    </div>

                    {/* גוף הסיכום - כמויות בלבד */}
                    <div className="p-6">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        
                        {/* קובייה לבשרי */}
                        <div className="border border-red-100 bg-red-50/50 rounded-lg p-3">
                          <div className="text-xs font-bold text-red-600 uppercase mb-1">בשרי</div>
                          <div className="text-3xl font-black text-red-700">{day.totals.meat}</div>
                        </div>

                        {/* קובייה לחלבי */}
                        <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-3">
                          <div className="text-xs font-bold text-blue-600 uppercase mb-1">חלבי</div>
                          <div className="text-3xl font-black text-blue-700">{day.totals.dairy}</div>
                        </div>

                        {/* קובייה לפרווה */}
                        <div className="border border-green-100 bg-green-50/50 rounded-lg p-3">
                          <div className="text-xs font-bold text-green-600 uppercase mb-1">פרווה</div>
                          <div className="text-3xl font-black text-green-700">{day.totals.parve}</div>
                        </div>

                        {/* קובייה לבוקר/אחר */}
                        <div className="border border-orange-100 bg-orange-50/50 rounded-lg p-3">
                          <div className="text-xs font-bold text-orange-600 uppercase mb-1">בוקר/אחר</div>
                          <div className="text-3xl font-black text-orange-700">{day.totals.other}</div>
                        </div>

                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* --- Footer --- */}
              <div className="avoid-break mt-auto pt-6 border-t border-gray-100 flex justify-between items-end text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                <div>הופק ע"י מערכת ציפורי • {new Date().toLocaleDateString('he-IL')}</div>
                <div>עמוד {idx + 1} מתוך {staffPages.length}</div>
              </div>

            </div>
          );
        })
      )}
    </div>,
    printRoot
  );
}