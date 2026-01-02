import React, { useState, useEffect, useRef } from 'react';
import { Clock, Users, Info, MapPin } from 'lucide-react';

export default function DayScheduler({ 
  date, 
  halls, 
  groups, 
  currentGroupId 
}) {
  const containerRef = useRef(null);
  
  // הגדרות זמן - ציר אנכי
  const START_HOUR = 6; 
  const END_HOUR = 30; // חצות
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

  // גובה פיקסלים לשעה (קובע את הגובה הכללי של הלוח)
  const HOUR_HEIGHT = 100; 
  const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

  const [nowPercent, setNowPercent] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateTime = () => {
        const now = new Date();
        if (now.toDateString() === date.toDateString()) {
            const currentH = now.getHours();
            const normalizedH = currentH < START_HOUR ? currentH + 24 : currentH;
            const minutes = now.getMinutes();
            const minutesFromStart = (normalizedH - START_HOUR) * 60 + minutes;
            const totalMinutes = TOTAL_HOURS * 60;
            setNowPercent((minutesFromStart / totalMinutes) * 100);
        } else {
            setNowPercent(null);
        }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [date]);

  // גלילה אוטומטית לשעה הנוכחית (אנכית)
  useEffect(() => {
    if (nowPercent && containerRef.current) {
        const scrollTop = (TOTAL_HEIGHT * (nowPercent / 100)) - 100;
        containerRef.current.scrollTop = scrollTop;
    }
  }, [nowPercent]);

  // חישוב מיקום אנכי (Top) וגובה (Height)
  const getVerticalPosition = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const normalizedH = h < START_HOUR ? h + 24 : h; 
    const minutesFromStart = (normalizedH - START_HOUR) * 60 + m;
    return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  const getEventHeight = (start, end) => {
    const startPx = getVerticalPosition(start);
    let endPx = getVerticalPosition(end);
    if (endPx <= startPx) endPx = getVerticalPosition("24:00"); 
    return endPx - startPx;
  };

  const getEventsForHall = (hallId) => {
    const relevantEvents = [];
    groups.forEach(group => {
      group.schedule.forEach(event => {
        const eventDate = new Date(event.date);
        const [h] = event.startTime.split(':').map(Number);
        
        // לוגיקה זהה: האם האירוע שייך ליום הזה (06:00 עד סוף היום) או ללילה של מחר (עד 06:00)
        const isTodayRegular = eventDate.toDateString() === date.toDateString() && h >= 6;
        
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const isTomorrowEarly = eventDate.toDateString() === nextDay.toDateString() && h < 6;

        if (event.hall?._id === hallId && (isTodayRegular || isTomorrowEarly)) {
          relevantEvents.push({
            ...event,
            groupName: group.name,
            isCurrentGroup: group._id === currentGroupId
          });
        }
      });
    });
    return relevantEvents;
  };

  return (
    <div 
        className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden select-none font-sans relative"
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
        
        {/* --- Tooltip (הכרטיס הצף) --- */}
        {hoveredEvent && (
            <div 
                className="fixed z-[60] bg-slate-900 text-white p-4 rounded-xl shadow-2xl pointer-events-none w-64 animate-in fade-in zoom-in-95 duration-150 border border-slate-700"
                style={{ left: mousePos.x + 20, top: mousePos.y + 10 }}
            >
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${hoveredEvent.isCurrentGroup ? 'bg-blue-400' : 'bg-rose-500'}`}></div>
                    <span className="font-bold text-xs text-slate-300">
                        {hoveredEvent.isCurrentGroup ? 'הקבוצה שלי' : 'קבוצה אחרת'}
                    </span>
                </div>
                <h4 className="font-bold text-lg mb-1">{hoveredEvent.title}</h4>
                <div className="text-slate-400 text-sm mb-2">{hoveredEvent.groupName}</div>
                <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg text-xs font-mono mb-2">
                    <Clock size={14} className="text-blue-400" />
                    <span>{hoveredEvent.startTime} - {hoveredEvent.endTime}</span>
                </div>
                {hoveredEvent.pax > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Users size={14} /> <span>{hoveredEvent.pax} משתתפים</span>
                    </div>
                )}
            </div>
        )}

      {/* --- כותרת עליונה (Sticky Header - Halls) --- */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-30 h-16 shadow-sm">
        <div className="w-20 flex-shrink-0 border-l border-slate-100 bg-white z-40"></div> {/* פינה ריקה לשעות */}
        <div className="flex-1 overflow-hidden">
            <div className="flex min-w-full">
                {halls.map(hall => (
                    <div key={hall._id} className="flex-1 min-w-[80px] p-3 text-center border-r border-slate-100 flex flex-col justify-center items-center hover:bg-slate-50 transition-colors">
                        <span className="font-bold text-slate-800 text-sm block">{hall.name}</span>
                        {hall.capacity && <span className="text-[10px] text-slate-400 mt-1">עד {hall.capacity} איש</span>}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* --- גוף הלוח (Scrollable Area) --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50/30" ref={containerRef}>
        
        <div className="flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
            
            {/* 1. ציר הזמן (Sticky Right Sidebar) */}
            <div className="w-20 flex-shrink-0 border-l border-slate-200 bg-white sticky right-0 z-20 flex flex-col text-xs text-slate-400 font-medium select-none">
                {hours.map((hour) => (
                    <div key={hour} className="flex-1 border-b border-slate-50 relative">
                        <span className="absolute -top-2.5 right-4 bg-white px-1">
                            {hour.toString().padStart(2, '0')}:00
                        </span>
                    </div>
                ))}
            </div>

            {/* 2. עמודות האולמות */}
            <div className="flex-1 flex relative min-w-full">
                
                {/* קווי רשת אופקיים (Grid Lines) */}
                <div className="absolute inset-0 pointer-events-none z-0">
                    {hours.map((_, i) => (
                        <div 
                            key={i} 
                            className="w-full border-b border-slate-100" 
                            style={{ height: `${HOUR_HEIGHT}px` }}
                        ></div>
                    ))}
                </div>

                {/* קו זמן נוכחי (Horizontal Red Line) */}
                {nowPercent !== null && (
                    <div 
                        className="absolute left-0 right-0 h-px bg-red-500 z-10 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center justify-end"
                        style={{ top: `${nowPercent}%` }}
                    >
                         <div className="bg-red-500 w-2 h-2 rounded-full -mr-1"></div>
                         <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-l-md absolute right-0 -top-2.5">
                            עכשיו
                        </div>
                    </div>
                )}

                {/* תוכן העמודות */}
                {halls.map(hall => {
                    const hallEvents = getEventsForHall(hall._id);
                    
                    return (
                        <div key={hall._id} className="flex-1 min-w-[80px] border-r border-slate-100 relative group">
                            
                            {/* אפקט הובר עמודה */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.01] transition-colors pointer-events-none"></div>

                            {hallEvents.map((event, idx) => (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setHoveredEvent(event)}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                    className={`
                                        absolute left-1 right-1 rounded-lg p-2.5 shadow-sm border
                                        flex flex-col justify-start overflow-hidden cursor-pointer transition-all hover:z-20 hover:scale-[1.02]
                                        ${event.isCurrentGroup 
                                            ? 'bg-blue-600 border-blue-700 text-white shadow-blue-200/50' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }
                                    `}
                                    style={{
                                        top: `${getVerticalPosition(event.startTime)}px`,
                                        height: `${getEventHeight(event.startTime, event.endTime)}px`
                                    }}
                                >
                                    {/* פס צד דק */}
                                    {!event.isCurrentGroup && <div className="absolute top-0 bottom-0 right-0 w-1 bg-rose-400"></div>}

                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-xs truncate leading-tight">{event.title}</span>
                                    </div>

                                    {/* תצוגה תלויה בגובה האירוע */}
                                    {getEventHeight(event.startTime, event.endTime) > 40 && (
                                        <div className={`text-[10px] mt-1 ${event.isCurrentGroup ? 'opacity-80' : 'opacity-60'}`}>
                                            <div className="font-mono">{event.startTime} - {event.endTime}</div>
                                            {!event.isCurrentGroup && <div className="truncate mt-0.5 font-medium">{event.groupName}</div>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}