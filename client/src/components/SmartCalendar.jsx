import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import api from '@/utils/api';
import { formatShortHebrewDate } from '../utils/hebrewDate';

/**
 * SmartCalendar v2
 *
 * Props:
 *   existingGroups: [{startDate, endDate, ...}]
 *   onSelectRange: ({start, end}) => void
 *   showQuotes: boolean (default true) — show amber dots for quote dates
 */
export default function SmartCalendar({ existingGroups = [], onSelectRange, showQuotes = true }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selection, setSelection] = useState({ start: null, end: null });
  const [quoteDates, setQuoteDates] = useState(new Set());

  // ─── Fetch quote dates ───
  useEffect(() => {
    if (!showQuotes) return;
    const fetchQuotes = async () => {
      try {
        const res = await api.get('/quotes');
        const quotes = res.data.data?.quotes || res.data || [];
        const dates = new Set();

        for (const q of quotes) {
          if (q.isConverted) continue;
          if (q.dates?.from) {
            const from = new Date(q.dates.from);
            const to = q.dates?.to ? new Date(q.dates.to) : from;
            const cursor = new Date(from);
            cursor.setHours(0, 0, 0, 0);
            const end = new Date(to);
            end.setHours(0, 0, 0, 0);
            while (cursor <= end) {
              dates.add(cursor.toISOString().split('T')[0]);
              cursor.setDate(cursor.getDate() + 1);
            }
          }
        }
        setQuoteDates(dates);
      } catch (err) {
        console.error('Failed to fetch quote dates:', err);
      }
    };
    fetchQuotes();
  }, [showQuotes]);

  // פונקציות עזר לתאריכים — זהה למקור
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getHebrewDate = (date) => formatShortHebrewDate(date);

  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  // לוגיקת בחירה — זהה למקור בדיוק
  const handleDayClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: clickedDate, end: null });
      onSelectRange({ start: clickedDate, end: null });
    } else {
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
    checkDate.setHours(0, 0, 0, 0);
    return (existingGroups || []).some(group => {
      if (!group.startDate || !group.endDate) return false;
      const start = new Date(group.startDate);
      const end = new Date(group.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  const isDateQuoted = (day) => {
    if (!showQuotes) return false;
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return quoteDates.has(d.toISOString().split('T')[0]);
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isOccupied = isDateOccupied(day);
      const quoted = isDateQuoted(day);
      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

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
            <span className="text-sm font-bold">{day}</span>
            <span className={`text-[10px] ${isSelectedStart || isSelectedEnd ? 'text-slate-300' : 'text-slate-400'}`}>
                {getHebrewDate(dateObj)}
            </span>

            {/* Indicator dots */}
            <div className="absolute top-1 right-1 flex gap-0.5">
              {isOccupied && (
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" title="קבוצה קיימת"></div>
              )}
              {quoted && (
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="הצעת מחיר"></div>
              )}
            </div>
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

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span>קבוצות קיימות</span>
        </div>
        {showQuotes && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
            <span>הצעות מחיר</span>
          </div>
        )}
      </div>
    </div>
  );
}