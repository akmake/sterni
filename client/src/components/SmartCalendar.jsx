import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export default function SmartCalendar({ existingGroups = [], onSelectRange }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selection, setSelection] = useState({ start: null, end: null });

  // פונקציות עזר לתאריכים
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  // המרה לתאריך עברי (פשוטה באמצעות Intl API המובנה בדפדפן)
  const getHebrewDate = (date) => {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'numeric' }).format(date);
  };

  // --- פונקציה מתוקנת למעבר חודשים בטוח ---
  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setDate(1); // מאפסים לראשון לחודש כדי למנוע דילוגים (כמו מ-31 ינואר למרץ)
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    // לוגיקת בחירה: התחלה -> סוף -> איפוס
    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: clickedDate, end: null });
      onSelectRange({ start: clickedDate, end: null });
    } else {
      // וידוא שהסוף הוא אחרי ההתחלה
      if (clickedDate < selection.start) {
         setSelection({ start: clickedDate, end: null });
         onSelectRange({ start: clickedDate, end: null });
      } else {
         setSelection({ ...selection, end: clickedDate });
         onSelectRange({ start: selection.start, end: clickedDate });
      }
    }
  };

  const isDateOccupied = (day) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    // בודק אם התאריך נופל בטווח של קבוצה קיימת כלשהי
    return existingGroups.some(group => {
      const start = new Date(group.startDate);
      const end = new Date(group.endDate);
      // איפוס שעות להשוואה הוגנת
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      return checkDate >= start && checkDate <= end;
    });
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // ריפוד ימים ריקים בהתחלה
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14"></div>);
    }

    // הימים עצמם
    for (let day = 1; day <= daysInMonth; day++) {
      const isOccupied = isDateOccupied(day);
      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      
      // בדיקה אם נבחר
      const isSelectedStart = selection.start?.toDateString() === dateObj.toDateString();
      const isSelectedEnd = selection.end?.toDateString() === dateObj.toDateString();
      const isInRange = selection.start && selection.end && dateObj > selection.start && dateObj < selection.end;

      days.push(
        <div 
          key={day}
          onClick={() => handleDayClick(day)}
          className={`
            relative h-14 border border-slate-50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200
            ${isOccupied ? 'bg-stripes-gray' : 'hover:bg-blue-50'}
            ${isSelectedStart || isSelectedEnd ? 'bg-slate-900 text-white shadow-lg z-10 scale-105 rounded-xl' : ''}
            ${isInRange ? 'bg-blue-100/50' : ''}
          `}
        >
            {/* המספר הלועזי */}
            <span className="text-sm font-bold">{day}</span>
            {/* התאריך העברי בקטן */}
            <span className={`text-[10px] ${isSelectedStart || isSelectedEnd ? 'text-slate-300' : 'text-slate-400'}`}>
                {getHebrewDate(dateObj)}
            </span>
            
            {/* אינדיקטור לתפוסה */}
            {isOccupied && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-400 rounded-full" title="יש קבוצות בתאריך זה"></div>
            )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm select-none">
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ChevronRight size={20} />
        </button>
        <span className="font-bold text-lg">
            {currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft size={20} />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2 text-xs text-slate-400 font-medium">
        <div>א</div><div>ב</div><div>ג</div><div>ד</div><div>ה</div><div>ו</div><div>ש</div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 rounded-xl overflow-hidden">
        {renderDays()}
      </div>
      
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 justify-end">
        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
        <span>קבוצות קיימות</span>
      </div>
    </div>
  );
}