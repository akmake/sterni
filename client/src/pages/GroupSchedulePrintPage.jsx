import React, { useEffect, useState, useMemo, useRef } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Printer, Download, Mail, ArrowRight, Loader2, Users, MapPin, Info } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import api from '../api';
import { toast } from 'react-hot-toast';

// --- Helpers (זהה ל-FullScheduleReportPage) ---
function normalizeEventToRow(event) {
  const isMeal = Boolean(event.isMeal) || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
  const pax = Number(event.pax || 0);
  const startTime = event.startTime || '00:00';
  let endTime = event.endTime || '';

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

const getNormalizedKosherType = (kosherType) => {
  if (!kosherType) return 'parve';
  const normalized = String(kosherType).toLowerCase().trim();
  if (normalized === 'meat' || normalized === 'בשרי' || normalized === 'בשר') return 'meat';
  if (normalized === 'halavi' || normalized === 'חלבי' || normalized === 'חלב' || normalized === 'dairy') return 'halavi';
  if (normalized === 'parve' || normalized === 'פרווה' || normalized === 'פרו') return 'parve';
  return 'parve';
};

export default function GroupSchedulePrintPage() {
  const [data, setData] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const rawData = localStorage.getItem('groupSchedulePrintData');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        setData(parsed);
        if (parsed.group?.contactPerson?.email) {
          setTargetEmail(parsed.group.contactPerson.email);
        }
      } catch (e) {
        console.error('Error parsing print data:', e);
      }
    }
  }, []);

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

  const printPages = useMemo(() => {
    if (!processedData) return [];
    return processedData.days.map((day) => ({
      group: processedData,
      day,
    }));
  }, [processedData]);

  const weekLabel = processedData?.days?.length > 0
    ? `${format(processedData.days[0].dateObj, 'dd/MM/yyyy', { locale: he })} - ${format(processedData.days[processedData.days.length - 1].dateObj, 'dd/MM/yyyy', { locale: he })}`
    : 'בלא תאריכים';

  // --- יצירת PDF ---
  const createPDFDocument = async () => {
    if (!containerRef.current) return null;
    const pdf = new jsPDF('p', 'mm', 'a4', true);
    const pdfWidth = 210;
    const pdfHeight = 297;

    const pageElements = containerRef.current.querySelectorAll('.schedule-page');

    for (let i = 0; i < pageElements.length; i++) {
      const element = pageElements[i];
      const dataUrl = await htmlToImage.toJpeg(element, {
        quality: 0.80,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        style: {
          margin: 0,
          transform: 'none',
        },
        filter: (node) => !node.classList?.contains('no-print')
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }
    return pdf;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading('מייצר PDF להורדה...');

    try {
      const pdf = await createPDFDocument();
      if (pdf) {
        const fileName = `לוז_${processedData?.name || 'קבוצה'}.pdf`.replace(/[^a-zA-Z0-9א-ת_.-]/g, '_');
        pdf.save(fileName);
        toast.success('הקובץ נוצר!', { id: toastId });
      }
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error('שגיאה ביצירת הקובץ', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!targetEmail) {
      toast.error('נא להזין כתובת מייל לשליחה');
      return;
    }
    if (isSending) return;
    setIsSending(true);
    const toastId = toast.loading('מייצר PDF ושולח למייל...');

    try {
      const pdf = await createPDFDocument();
      const pdfBlob = pdf.output('blob');

      const formData = new FormData();
      formData.append('file', pdfBlob, `schedule_${(processedData?.name || 'group').replace(/[^a-zA-Z0-9א-ת]/g, '_')}.pdf`);
      formData.append('email', targetEmail);
      formData.append('subject', `לו"ז - ${processedData?.name || 'קבוצה'}`);
      formData.append('body', `מצורף לו"ז עבור ${processedData?.name || 'הקבוצה'}.\n\nבברכה.`);

      await api.post('/emails/send-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('המייל נשלח בהצלחה!', { id: toastId });
      setShowEmailInput(false);
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בשליחה: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  if (!data || !processedData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">טוען נתונים...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dir-rtl font-sans">
      {/* --- סרגל כלים עליון --- */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.close()}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="חזרה"
            >
              <ArrowRight size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">לו"ז {processedData.name}</h1>
              <p className="text-xs text-slate-500">{weekLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* כפתור שליחה למייל */}
            {showEmailInput ? (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="כתובת מייל"
                  className="bg-transparent outline-none text-sm w-48 placeholder:text-blue-300"
                  autoFocus
                />
                <button
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {isSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  שלח
                </button>
                <button
                  onClick={() => setShowEmailInput(false)}
                  className="text-blue-400 hover:text-blue-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowEmailInput(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Mail size={16} /> שליחה למייל
              </button>
            )}

            {/* כפתור הורדת PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              הורד PDF
            </button>

            {/* כפתור הדפסה */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-black transition-colors shadow-md"
            >
              <Printer size={16} /> הדפסה
            </button>
          </div>
        </div>
      </div>

      {/* --- תצוגת הדפים (זהה ממש לפורמט של PrintableSchedule) --- */}
      <div ref={containerRef} className="max-w-[794px] mx-auto py-8 print:py-0 print:max-w-none space-y-6 print:space-y-0">
        {printPages.map(({ group, day }, idx) => {
          const isLast = idx === printPages.length - 1;
          const pageNo = idx + 1;
          const totalPages = printPages.length;

          return (
            <div
              key={`${group._id}-${format(day.dateObj, 'yyyy-MM-dd')}-${idx}`}
              className="schedule-page bg-white shadow-lg print:shadow-none rounded-xl print:rounded-none overflow-hidden"
              style={{ width: 794, minHeight: 1123, padding: '53px 53px 60px 53px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', direction: 'rtl', fontFamily: 'Assistant, system-ui, sans-serif', color: '#0f172a', margin: '0 auto' }}
            >
              {/* --- כותרת הדף (Header) --- */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 24, marginBottom: 32, breakInside: 'avoid' }}>
                <div>
                  <h1 style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    {group.name}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, fontWeight: 600, color: '#475569' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>
                      <Users size={14} /> {group.pax} משתתפים
                    </span>
                    {group.contactPerson?.name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Info size={14} /> {group.contactPerson.name}
                        {group.contactPerson.phone ? ` (${group.contactPerson.phone})` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    שבוע: {weekLabel}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
                    {format(day.dateObj, 'EEEE', { locale: he })}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: '#64748b', letterSpacing: '0.1em' }}>
                    {format(day.dateObj, 'dd.MM.yyyy')}
                  </div>
                </div>
              </div>

              {/* --- כותרות הטבלה --- */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', paddingBottom: 8, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16, breakInside: 'avoid' }}>
                <div style={{ width: 120 }}>שעות</div>
                <div style={{ flex: 1 }}>פעילות</div>
                <div style={{ width: 180 }}>מיקום</div>
                <div style={{ width: 90, textAlign: 'center' }}>כמות</div>
              </div>

              {/* --- שורות --- */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {day.events.map((ev, i) => {
                    const isLastRow = i === day.events.length - 1;
                    const noteText = ev.requirements || ev.notes;
                    const shouldShowNote = noteText && (!ev._smartDetail || !ev._smartDetail.includes(noteText));

                    return (
                      <div
                        key={`${idx}-${i}`}
                        style={{ display: 'flex', alignItems: 'flex-start', padding: '16px 0', borderBottom: !isLastRow ? '1px solid #f3f4f6' : 'none', breakInside: 'avoid' }}
                      >
                        {/* זמנים */}
                        <div style={{ width: 120, fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 700, color: '#64748b', paddingTop: 4, whiteSpace: 'nowrap' }}>
                          {ev.endTime || '--:--'} - {ev.startTime || '--:--'}
                        </div>

                        {/* פעילות */}
                        <div style={{ flex: 1, paddingRight: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                              {ev.title || 'ללא כותרת'}
                            </span>
                            {ev.kosherType && (() => {
                              const k = getNormalizedKosherType(ev.kosherType);
                              const colors = k === 'meat' ? { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' } : k === 'halavi' ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' } : { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
                              const label = k === 'meat' ? 'בשרי' : k === 'halavi' ? 'חלבי' : 'פרווה';
                              return (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                                  {label}
                                </span>
                              );
                            })()}
                          </div>

                          {ev._smartDetail ? (
                            <div style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>{ev._smartDetail}</div>
                          ) : (
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>—</div>
                          )}

                          {shouldShowNote && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', padding: 8, borderRadius: 4, display: 'inline-block', maxWidth: '100%', whiteSpace: 'pre-wrap' }}>
                              {noteText}
                            </div>
                          )}
                        </div>

                        {/* מיקום */}
                        <div style={{ width: 180, fontSize: 14, fontWeight: 500, color: '#475569', paddingTop: 4, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          {(ev.hall?.name || ev.locationText) && <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: '#94a3b8' }} />}
                          {ev.hall?.name || ev.locationText || '-'}
                        </div>

                        {/* כמות */}
                        <div style={{ width: 90, textAlign: 'center', paddingTop: 4 }}>
                          {ev._pax > 0 ? (
                            <span style={{ display: 'inline-block', background: '#0f172a', color: 'white', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, minWidth: 32 }}>
                              {ev._pax}
                            </span>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* --- Footer --- */}
              <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
                <div>הופק ע"י דהאן פתרונות טכנולוגים לעסקים• {new Date().toLocaleDateString('he-IL')}</div>
                <div>עמוד {pageNo} מתוך {totalPages} • {group.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Print CSS --- */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:space-y-0 > * + * { margin-top: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .schedule-page {
            break-after: page;
            page-break-after: always;
            width: 100% !important;
          }
          .schedule-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          @page {
            size: A4 portrait;
            margin: 14mm 14mm 16mm 14mm;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
