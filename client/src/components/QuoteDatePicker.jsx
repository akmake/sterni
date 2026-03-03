import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import SmartCalendar from './SmartCalendar';
import api from '@/utils/api';

/**
 * QuoteDatePicker
 *
 * Opens a SmartCalendar popup for selecting arrival/departure dates.
 * Uses the SAME selection logic as NewGroupPage (click start, click end).
 * Shows Hebrew+Gregorian formatted dates.
 *
 * Props:
 *   rawArrivalDate: string (YYYY-MM-DD)
 *   rawDepartureDate: string (YYYY-MM-DD)
 *   arrivalDateDisplay: string (formatted Hebrew text)
 *   departureDateDisplay: string (formatted Hebrew text)
 *   onDatesChange: ({ rawArrival, rawDeparture, arrivalDisplay, departureDisplay }) => void
 *   formatDateHebrew: (dateStr) => string
 */
export default function QuoteDatePicker({
  rawArrivalDate,
  rawDepartureDate,
  arrivalDateDisplay,
  departureDateDisplay,
  onDatesChange,
  formatDateHebrew,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [existingGroups, setExistingGroups] = useState([]);

  // Fetch groups for calendar dots
  useEffect(() => {
    if (!isOpen) return;
    const fetchGroups = async () => {
      try {
        const res = await api.get('/groups');
        const groups = res.data.data?.groups || res.data || [];
        setExistingGroups(groups);
      } catch (err) {
        console.error('Failed to fetch groups for calendar:', err);
      }
    };
    fetchGroups();
  }, [isOpen]);

  const toRawDate = (dateObj) => {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // SmartCalendar calls onSelectRange twice:
  // 1st click: { start: Date, end: null }  → we set arrival only
  // 2nd click: { start: Date, end: Date }  → we set both, then close
  const handleSelectRange = (range) => {
    if (range.start && !range.end) {
      // First click — set arrival date
      const raw = toRawDate(range.start);
      const display = formatDateHebrew(raw);
      onDatesChange({
        rawArrival: raw,
        rawDeparture: rawDepartureDate,
        arrivalDisplay: display,
        departureDisplay: departureDateDisplay,
      });
    }

    if (range.start && range.end) {
      // Second click — set both dates and close
      const rawStart = toRawDate(range.start);
      const rawEnd = toRawDate(range.end);
      const displayStart = formatDateHebrew(rawStart);
      const displayEnd = formatDateHebrew(rawEnd);

      onDatesChange({
        rawArrival: rawStart,
        rawDeparture: rawEnd,
        arrivalDisplay: displayStart,
        departureDisplay: displayEnd,
      });

      // Close after brief delay so user sees the selection
      setTimeout(() => setIsOpen(false), 400);
    }
  };

  return (
    <>
      <label className="block text-sm font-bold text-gray-600 mb-1 flex items-center gap-2">
        <CalendarIcon size={16} /> תאריכי אירוע
      </label>

      {/* Clickable date display — opens calendar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full text-right border border-gray-300 rounded-lg p-2.5 text-sm bg-white hover:bg-blue-50 hover:border-blue-300 transition-all"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 min-w-[40px]">הגעה:</span>
            {arrivalDateDisplay ? (
              <span className="text-slate-800 font-medium text-xs">{arrivalDateDisplay}</span>
            ) : (
              <span className="text-gray-400 text-xs">בחר תאריך...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 min-w-[40px]">עזיבה:</span>
            {departureDateDisplay ? (
              <span className="text-slate-800 font-medium text-xs">{departureDateDisplay}</span>
            ) : (
              <span className="text-gray-400 text-xs">בחר תאריך...</span>
            )}
          </div>
        </div>
      </button>

      <div className="text-[10px] text-gray-400 mt-1">לחץ לפתיחת לוח שנה · לחיצה ראשונה = הגעה · שנייה = עזיבה</div>

      {/* Calendar popup */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] max-w-[92vw] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <div className="text-sm font-bold text-slate-800">בחירת תאריכים</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  לחיצה ראשונה = הגעה, לחיצה שנייה = עזיבה
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Calendar */}
            <div className="p-4">
              <SmartCalendar
                existingGroups={existingGroups}
                onSelectRange={handleSelectRange}
                showQuotes={true}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}