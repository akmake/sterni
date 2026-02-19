import React, { useEffect, useState, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { he } from 'date-fns/locale';
import PrintableSchedule from '@/components/reports/PrintableSchedule';

// --- Helpers (זהה ל-FullScheduleReportPage) ---
function normalizeEventToRow(event) {
  const isMeal = Boolean(event.isMeal) || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
  const pax = Number(event.pax || 0);
  const startTime = event.startTime || '00:00';
  let endTime = event.endTime || '';

  // יצירת _smartDetail (תפריט / פירוט ארוחה)
  let smartDetail = '';
  if (isMeal && event.menuItem) {
    smartDetail = event.menuItem;
  } else if (event.requirements) {
    smartDetail = event.requirements;
  } else {
    smartDetail = event.description || '';
  }

  return {
    ...event,
    startTime,
    endTime,
    _isMeal: isMeal,
    _pax: Number.isFinite(pax) ? pax : 0,
    _smartDetail: smartDetail,
  };
}

const getBusinessDaySortValue = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (hours < 6) return (hours + 24) * 60 + minutes;
  return hours * 60 + minutes;
};

export default function GroupSchedulePrintPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const rawData = localStorage.getItem('groupSchedulePrintData');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        setData(parsed);
      } catch (e) {
        console.error('Error parsing print data:', e);
      }
    }
  }, []);

  // עיבוד נתונים בדיוק כמו FullScheduleReportPage
  const processedData = useMemo(() => {
    if (!data || !data.group) return null;

    const group = data.group;
    const schedule = data.schedule || [];

    const daysMap = new Map();
    schedule.forEach((event) => {
      if (!event?.date) return;
      
      let eventDate = parseISO(event.date);
      const [hRaw] = String(event.startTime || '00:00').split(':');
      if (Number(hRaw) < 6) eventDate = subDays(eventDate, 1);

      const dayKey = format(eventDate, 'yyyy-MM-dd');
      if (!daysMap.has(dayKey)) {
        daysMap.set(dayKey, { dateObj: eventDate, events: [] });
      }
      daysMap.get(dayKey).events.push(normalizeEventToRow(event));
    });

    const days = Array.from(daysMap.values())
      .sort((a, b) => a.dateObj - b.dateObj)
      .map((day) => ({
        ...day,
        events: day.events.sort((a, b) => getBusinessDaySortValue(a.startTime) - getBusinessDaySortValue(b.startTime)),
      }));

    return { ...group, days };
  }, [data]);

  // הכנת דפים להדפסה
  const printPages = useMemo(() => {
    if (!processedData) return [];
    return processedData.days.map((day) => ({
      group: processedData,
      day,
    }));
  }, [processedData]);

  // קריאה ל-window.print() כשהדע טוען
  useEffect(() => {
    if (data && processedData) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [processedData]);

  if (!data || !processedData) {
    return null;
  }

  const weekLabel = processedData.days.length > 0
    ? `${format(processedData.days[0].dateObj, 'dd/MM/yyyy', { locale: he })} - ${format(processedData.days[processedData.days.length - 1].dateObj, 'dd/MM/yyyy', { locale: he })}`
    : 'בלא תאריכים';

  return (
    <PrintableSchedule
      printPages={printPages}
      weekLabel={weekLabel}
    />
  );
}
