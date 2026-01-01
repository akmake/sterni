import React from 'react';

export default function DayScheduler({ 
  date, 
  halls, 
  groups, 
  currentGroupId 
}) {
  const START_HOUR = 6; 
  const END_HOUR = 24;  
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

  // חישובים מתמטיים למיקום (באחוזים מדויקים)
  const getPositionPercent = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const normalizedH = h < START_HOUR ? h + 24 : h; 
    const minutesFromStart = (normalizedH - START_HOUR) * 60 + m;
    const totalMinutes = TOTAL_HOURS * 60;
    return (minutesFromStart / totalMinutes) * 100;
  };

  const getDurationPercent = (start, end) => {
    const startPos = getPositionPercent(start);
    let endPos = getPositionPercent(end);
    if (endPos <= startPos) endPos = getPositionPercent("24:00"); 
    return endPos - startPos;
  };

  const getEventsForHall = (hallId) => {
    const relevantEvents = [];
    groups.forEach(group => {
      group.schedule.forEach(event => {
        const eventDate = new Date(event.date);
        if (event.hall?._id === hallId && eventDate.toDateString() === date.toDateString()) {
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
    <div className="border border-slate-300 rounded-lg bg-white overflow-hidden text-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px] relative">
          
          {/* כותרת שעות - גריד מדויק */}
          <div className="flex bg-slate-100 border-b border-slate-300 h-10">
            <div className="w-32 flex-shrink-0 border-l border-slate-300 p-2 font-bold text-slate-600 sticky right-0 bg-slate-100 z-10 text-center">
              אולם
            </div>
            <div className="flex-1 flex relative">
              {hours.map((hour) => (
                <div key={hour} className="flex-1 border-r border-slate-300 text-center pt-2 text-xs text-slate-500">
                  {hour}:00
                </div>
              ))}
            </div>
          </div>

          {/* גוף הטבלה */}
          <div>
            {halls.map(hall => {
              const hallEvents = getEventsForHall(hall._id);
              
              return (
                <div key={hall._id} className="flex h-16 border-b border-slate-200 relative">
                  {/* שם האולם */}
                  <div className="w-32 flex-shrink-0 border-l border-slate-300 p-2 flex items-center justify-center font-bold text-slate-700 bg-white sticky right-0 z-10 shadow-[ -2px_0_5px_rgba(0,0,0,0.05)]">
                    {hall.name}
                  </div>

                  {/* ציר הזמן */}
                  <div className="flex-1 relative bg-slate-50/30">
                    {/* קווי רשת רקע */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {hours.map((h) => (
                        <div key={h} className="flex-1 border-r border-slate-200 border-dashed"></div>
                      ))}
                    </div>

                    {/* אירועים */}
                    {hallEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className={`
                          absolute top-2 bottom-2 rounded px-2 flex flex-col justify-center overflow-hidden border shadow-sm
                          ${event.isCurrentGroup 
                            ? 'bg-slate-800 text-white border-slate-900 z-20' 
                            : 'bg-blue-100 text-blue-800 border-blue-300 opacity-80'
                          }
                        `}
                        style={{
                          right: `${100 - (getPositionPercent(event.startTime) + getDurationPercent(event.startTime, event.endTime))}%`, // RTL positioning fix
                          width: `${getDurationPercent(event.startTime, event.endTime)}%`
                        }}
                        title={`${event.title} (${event.startTime}-${event.endTime})`}
                      >
                        <span className="font-bold text-xs truncate">{event.title}</span>
                        {!event.isCurrentGroup && <span className="text-[10px] truncate">{event.groupName}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}