import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, X, Users, FileText, Calendar, CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { formatShortHebrewDate } from '../utils/hebrewDate';

/**
 * GroupsCalendarModal — לוח שנה עם נקודות לקבוצות והצעות מחיר
 * לחיצה על יום פותחת פירוט של הקבוצות וההצעות באותו תאריך
 */
export default function GroupsCalendarModal({ groups = [], onClose }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quotes, setQuotes] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  // --- טעינת הצעות מחיר ---
  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const res = await api.get('/quotes');
        const data = res.data.data?.quotes || res.data || [];
        setQuotes(data);
      } catch (err) {
        console.error('Failed to fetch quotes:', err);
      }
    };
    fetchQuotes();
  }, []);

  // --- מיפוי תאריכים לקבוצות ---
  const groupDateMap = useMemo(() => {
    const map = new Map();
    (groups || []).forEach(group => {
      if (!group.startDate || !group.endDate) return;
      const start = new Date(group.startDate);
      const end = new Date(group.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = cursor.toISOString().split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(group);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [groups]);

  // --- מיפוי תאריכים להצעות מחיר ---
  const quoteDateMap = useMemo(() => {
    const map = new Map();
    quotes.forEach(q => {
      if (q.isConverted) return;
      if (!q.dates?.from) return;
      const from = new Date(q.dates.from);
      const to = q.dates?.to ? new Date(q.dates.to) : from;
      from.setHours(0, 0, 0, 0);
      to.setHours(0, 0, 0, 0);
      const cursor = new Date(from);
      while (cursor <= to) {
        const key = cursor.toISOString().split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(q);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [quotes]);

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const changeMonth = (increment) => {
    const d = new Date(currentDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + increment);
    setCurrentDate(d);
    setSelectedDay(null);
  };

  const getHebrewDate = (date) => formatShortHebrewDate(date);

  const handleDayClick = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const key = dateObj.toISOString().split('T')[0];
    const dayGroups = groupDateMap.get(key) || [];
    const dayQuotes = quoteDateMap.get(key) || [];
    if (dayGroups.length === 0 && dayQuotes.length === 0) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay({ date: dateObj, key, groups: dayGroups, quotes: dayQuotes });
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const key = dateObj.toISOString().split('T')[0];
      const hasGroups = groupDateMap.has(key);
      const hasQuotes = quoteDateMap.has(key);
      const isSelected = selectedDay?.key === key;
      const isToday = dateObj.getTime() === today.getTime();

      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`
            relative h-14 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 rounded-lg
            ${isSelected ? 'bg-slate-900 text-white shadow-lg scale-105 z-10' : ''}
            ${!isSelected && isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}
            ${!isSelected && (hasGroups || hasQuotes) ? 'hover:bg-blue-50' : 'hover:bg-slate-50'}
          `}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-white' : ''}`}>{day}</span>
          <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
            {getHebrewDate(dateObj)}
          </span>

          {/* נקודות */}
          <div className="absolute top-1 right-1 flex gap-0.5">
            {hasGroups && <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />}
            {hasQuotes && <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-xl">
              <Calendar size={20} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">לוח שנה</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Calendar */}
        <div className="p-5">
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
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span>קבוצות</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
              <span>הצעות מחיר</span>
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div className="border-t border-slate-100 p-5 bg-slate-50/50 max-h-60 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-600 mb-3">
              {selectedDay.date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>

            {/* קבוצות */}
            {selectedDay.groups.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">קבוצות</p>
                <div className="space-y-2">
                  {selectedDay.groups.map((g) => (
                    <div
                      key={g._id}
                      onClick={() => { onClose(); navigate(`/groups/${g._id}`); }}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <Users size={16} className="text-red-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{g.name}</p>
                        <p className="text-xs text-slate-400">
                          {g.pax} משתתפים • {g.hostingType === 'seminar' ? 'יום עיון' : 'לינה'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* הצעות מחיר */}
            {selectedDay.quotes.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">הצעות מחיר</p>
                <div className="space-y-2">
                  {selectedDay.quotes.map((q, i) => (
                    <div
                      key={q._id || i}
                      onClick={() => { onClose(); navigate('/price-quote', { state: { loadQuote: q.name } }); }}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <FileText size={16} className="text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{q.clientName || q.name}</p>
                        <p className="text-xs text-slate-400">
                          {q.pax ? `${q.pax} משתתפים` : ''}
                          {q.eventType ? ` • ${q.eventType}` : ''}
                          {q.dates?.from && (
                            <> • {new Date(q.dates.from).toLocaleDateString('he-IL')}
                              {q.dates?.to && ` - ${new Date(q.dates.to).toLocaleDateString('he-IL')}`}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
