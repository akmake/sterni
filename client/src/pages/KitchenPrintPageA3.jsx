import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { MapPin, Users } from 'lucide-react';

// --- פונקציות עזר ---

const MEAL_LABELS = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
  snack: 'כיבוד/אחר',
};

const getKosherMeta = (type) => {
  if (!type) return { label: '', color: 'gray' };
  const t = type.toLowerCase();
  if (t === 'meat' || t === 'בשרי') return { label: 'בשרי', color: 'red' };
  if (t === 'halavi' || t === 'חלבי') return { label: 'חלבי', color: 'blue' };
  if (t === 'parve' || t === 'פרווה') return { label: 'פרווה', color: 'green' };
  return { label: '', color: 'gray' };
};

const cx = (...classes) => classes.filter(Boolean).join(' ');

// לוגיקת מיון יום עסקים (06:00 עד 06:00 למחרת)
const getSortValue = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const adjustedHour = h < 6 ? h + 24 : h; 
  return adjustedHour * 60 + (m || 0);
};

// פונקציה שמחלקת מערך לצ'אנקים (למשל של 7)
const chunkArray = (arr, size) => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
};

export default function KitchenPrintPageA3() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const rawData = localStorage.getItem('kitchenPrintData');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (parsed.weekDays) {
          parsed.weekDays = parsed.weekDays.map(d => new Date(d));
        }
        setData(parsed);
        // השהייה קצרה לרינדור
        setTimeout(() => window.print(), 800);
      } catch (e) {
        console.error("Error parsing print data", e);
      }
    }
  }, []);

  if (!data) return <div className="p-10 text-center font-bold text-xl">טוען נתונים להדפסה...</div>;

  const { weekDays, dailyMap, weekRangeText } = data;

  // --- שלב 1: עיבוד וסינון הימים ---
  // אנחנו לוקחים רק ימים שיש בהם אירועים, ומחשבים כמה עמודות כל יום צריך
  const activeDays = weekDays
    .slice(0, 6) // ראשון עד שישי
    .map(dateObj => {
      const dateKey = dateObj.toDateString();
      const rawEvents = dailyMap[dateKey] || [];
      
      // מיון כרונולוגי לפי יום עסקים
      const events = [...rawEvents].sort((a, b) => {
        const valA = a.sortValue ?? getSortValue(a.startTime);
        const valB = b.sortValue ?? getSortValue(b.startTime);
        return valA - valB;
      });

      // חישוב כמה עמודות היום הזה צריך (מינימום 1 עמודה אם יש אירועים)
      // אם אין אירועים בכלל - היום יסונן בהמשך
      const columnsNeeded = Math.ceil(events.length / 7);

      return {
        dateObj,
        events,
        columnsNeeded: columnsNeeded === 0 ? 0 : columnsNeeded, // אם 0 אירועים אז 0 עמודות
        chunks: chunkArray(events, 7) // חלוקה למערכים של 7
      };
    })
    .filter(day => day.events.length > 0); // מעיפים ימים ריקים!

  // --- שלב 2: חישוב רוחב הגריד הכללי ---
  // סוכמים את כל העמודות הנדרשות כדי לדעת במה לחלק את הדף
  const totalGridColumns = activeDays.reduce((acc, day) => acc + day.columnsNeeded, 0);

  // מונע באג אם אין נתונים בכלל
  const finalGridCols = totalGridColumns > 0 ? totalGridColumns : 1;

  return (
    <div className="w-full h-full bg-white text-black dir-rtl font-sans" dir="rtl">
      
      <style>{`
        @page {
          size: A3 landscape;
          margin: 5mm;
        }
        html, body {
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
            .no-print { display: none; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-2 h-[50px] px-4 pt-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-black text-slate-900 leading-none">לוח מטבח שבועי</h1>
          <div className="text-xl font-bold text-slate-600">{weekRangeText}</div>
        </div>
        <div className="text-left text-xs font-mono text-slate-500">
          A3 Landscape • הופק: {new Date().toLocaleDateString('he-IL')} • {totalGridColumns} עמודות פעילות
        </div>
      </div>

      {/* Dynamic Grid Container */}
      {/* כאן הקסם: אנחנו אומרים לגריד להתחלק בדיוק לפי מספר העמודות שחישבנו */}
      <div 
        className="grid gap-0 h-[calc(100vh-80px)] items-stretch border-r border-slate-300 px-4 pb-4"
        style={{ 
          gridTemplateColumns: `repeat(${finalGridCols}, minmax(0, 1fr))` 
        }}
      >
        
        {activeDays.length === 0 && (
           <div className="col-span-full text-center text-2xl text-slate-400 mt-20">אין אירועים להצגה בטווח זה</div>
        )}

        {activeDays.map((day, i) => {
          return (
            <div 
              key={i} 
              // כל יום תופס "משבצות" בגריד לפי כמות הטורים שהוא צריך (span)
              style={{ gridColumn: `span ${day.columnsNeeded}` }}
              className="flex flex-col border-l border-slate-300 h-full overflow-hidden"
            >
              
              {/* כותרת יום (נמתחת על פני כל תתי-העמודות של אותו יום) */}
              <div className="flex justify-between items-center mb-1.5 pb-1 border-b-2 border-slate-800 px-2 pt-1 bg-slate-50">
                <div>
                  <span className="text-lg font-black text-slate-900 ml-2">
                    {format(day.dateObj, 'EEEE', { locale: he })}
                  </span>
                  <span className="text-xs text-slate-500">{format(day.dateObj, 'd בMMMM', { locale: he })}</span>
                </div>
                <div className="text-sm font-bold text-slate-400">
                  {format(day.dateObj, 'dd/MM')}
                </div>
              </div>

              {/* גוף היום: מחולק פנימית לתתי-עמודות אם צריך */}
              <div className="flex flex-1 w-full divide-x divide-x-reverse divide-slate-200">
                {day.chunks.map((chunkEvents, chunkIdx) => (
                  <div key={chunkIdx} className="flex-1 flex flex-col gap-2 px-1.5 pt-1 min-w-0">
                    
                    {chunkEvents.map((ev, idx) => {
                      const kosher = getKosherMeta(ev.kosherType);
                      const mealLabel = MEAL_LABELS[ev.mealType] || ev.title || 'אירוע';
                      
                      const borderColor = kosher.color === 'red' ? 'border-red-500' : 
                                        kosher.color === 'blue' ? 'border-blue-500' : 
                                        kosher.color === 'green' ? 'border-green-500' : 'border-slate-300';
                      const titleColor = kosher.color === 'red' ? 'text-red-700' : 
                                       kosher.color === 'blue' ? 'text-blue-700' : 'text-slate-800';

                      return (
                        <div key={idx} className={cx(
                            'relative bg-white border border-slate-300 shadow-sm rounded-sm border-r-[3px] p-2',
                            borderColor
                          )}>
                          
                          {/* שורה 1: שעה + שם קבוצה */}
                          <div className="flex justify-between items-start mb-0.5">
                            <span className="bg-slate-800 text-white font-mono font-bold rounded px-1 text-[10px]">
                              {ev.startTime || '--:--'}
                            </span>
                            <span className="font-bold truncate w-[60%] text-left text-xs">
                              {ev.groupName || '-'}
                            </span>
                          </div>
                          
                          {/* שורה 2: ארוחה */}
                          <div className={cx("font-black leading-tight text-sm mb-1", titleColor)}>
                            {mealLabel} 
                            {kosher.label && (
                              <span className="opacity-60 text-black font-normal scale-75 inline-block">
                                ({kosher.label})
                              </span>
                            )}
                          </div>
                          
                          {/* שורה 3: תפריט */}
                          {ev.smartMenu && ev.smartMenu !== '-' && (
                            <div className="bg-slate-50 rounded text-slate-800 border border-slate-100 whitespace-pre-wrap leading-tight text-[10px] p-1 mb-1">
                              {ev.smartMenu}
                            </div>
                          )}
                          
                          {/* שורה 4: פרטים */}
                          <div className="flex items-center justify-between mt-auto pt-0.5 border-t border-slate-100 text-slate-500">
                            <div className="flex items-center gap-0.5">
                              <MapPin size={10} />
                              <span className="text-[9px]">{ev.hall?.name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-0.5 text-black font-bold">
                              <Users size={10} />
                              <span className="text-[10px]">{ev.pax || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                
                {/* אם ליום מסוים יש "שארית" ברוחב (למשל צריך 2 עמודות אבל בחישוב יצא שיש מקום ריק),
                   הקוד הזה דואג שהחלוקה תהיה נכונה ויזואלית בתוך היום.
                   אבל בשיטה הנוכחית ה-chunks מסדרים את זה בול.
                */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}