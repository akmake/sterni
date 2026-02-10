import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ArrowRight, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const getKosherType = (kosher) => {
  if (!kosher) return 'לא צוין';
  const k = kosher.toLowerCase();
  if (k.includes('meat') || k.includes('בשר')) return 'בשרי';
  if (k.includes('dairy') || k.includes('חלב') || k.includes('halavi')) return 'חלבי';
  if (k.includes('parve') || k.includes('פרו')) return 'פרווה';
  return 'לא צוין';
};

const StaffPrintView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { reportData, weekLabel } = location.state || {};
  const [staffPages, setStaffPages] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (reportData && reportData.length > 0) {
      processDataForPrint(reportData);
    }
  }, [reportData]);

  const processDataForPrint = (data) => {
    const workerMap = {};

    data.forEach(item => {
      const workerName = item.responsible.trim();
      if (!workerMap[workerName]) workerMap[workerName] = {};

      const dateKey = format(item.date, 'yyyy-MM-dd');
      if (!workerMap[workerName][dateKey]) {
        workerMap[workerName][dateKey] = {
          dateObj: item.date,
          dateDisplay: format(item.date, 'EEEE, dd/MM/yyyy', { locale: he }),
          totals: { בשרי: 0, חלבי: 0, פרווה: 0, 'לא צוין': 0 }
        };
      }

      const qty = Number(item.pax) || 0;
      const kosherType = getKosherType(item.kosherTypeRaw || item.kosherType);
      workerMap[workerName][dateKey].totals[kosherType] += qty;
    });

    const pages = Object.keys(workerMap).map(workerName => {
      const days = Object.values(workerMap[workerName]).sort((a, b) => a.dateObj - b.dateObj);
      const weekTotals = { בשרי: 0, חלבי: 0, פרווה: 0, 'לא צוין': 0 };
      days.forEach(day => {
        weekTotals.בשרי += day.totals.בשרי;
        weekTotals.חלבי += day.totals.חלבי;
        weekTotals.פרווה += day.totals.פרווה;
        weekTotals['לא צוין'] += day.totals['לא צוין'];
      });
      return { name: workerName, days, weekTotals };
    });

    setStaffPages(pages);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageElements = document.querySelectorAll('.pdf-page');

    try {
      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i];
        
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      pdf.save(`דוח-צוות-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('שגיאה ביצירת PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!reportData) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-600">אין נתונים</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-lg">חזרה</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dir-rtl font-sans">
      {/* כפתורים */}
      <div className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto py-4 px-6 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition">
            <ArrowRight size={18} />
            חזרה
          </button>
          <div className="flex gap-3">
            <button 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              <Download size={16} />
              {isGeneratingPDF ? 'מייצר PDF...' : 'שמור PDF'}
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              <Printer size={16} />
              הדפס
            </button>
          </div>
        </div>
      </div>

      {/* CSS */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; }
          .pdf-page { break-after: page; page-break-after: always; margin: 0; }
          .pdf-page.is-last { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      {/* תוכן */}
      <div className="py-6">
        {staffPages.length === 0 ? (
          <div className="pdf-page is-last bg-white mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
            <div className="text-center text-2xl text-slate-400">אין נתונים</div>
          </div>
        ) : (
          staffPages.map((worker, idx) => (
            <div 
              key={idx} 
              className={`pdf-page ${idx === staffPages.length - 1 ? 'is-last' : ''} bg-white mx-auto mb-6 shadow-lg print:shadow-none print:mb-0`}
              style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
            >
              {/* כותרת */}
              <div className="border-b-4 border-orange-500 pb-4 mb-8">
                <h1 className="text-3xl font-black text-slate-900">{worker.name}</h1>
                <p className="text-slate-500 text-base mt-2">{weekLabel}</p>
              </div>

              {/* ימים */}
              <div className="space-y-6 mb-10">
                {worker.days.map((day, dayIdx) => (
                  <div key={dayIdx} className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-300">
                      {day.dateDisplay}
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center bg-red-50 rounded-lg p-3 border-2 border-red-200">
                        <div className="text-xs text-red-600 font-semibold mb-1">בשרי</div>
                        <div className="text-3xl font-black text-red-800">{day.totals.בשרי}</div>
                      </div>
                      
                      <div className="text-center bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                        <div className="text-xs text-blue-600 font-semibold mb-1">חלבי</div>
                        <div className="text-3xl font-black text-blue-800">{day.totals.חלבי}</div>
                      </div>
                      
                      <div className="text-center bg-green-50 rounded-lg p-3 border-2 border-green-200">
                        <div className="text-xs text-green-600 font-semibold mb-1">פרווה</div>
                        <div className="text-3xl font-black text-green-800">{day.totals.פרווה}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* סיכום שבועי */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border-2 border-slate-300 mt-auto">
                <h3 className="text-xl font-black text-slate-900 mb-4">סיכום שבועי</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center bg-white rounded-lg p-4 border-2 border-red-300 shadow-sm">
                    <div className="text-sm text-red-700 font-bold mb-1">בשרי</div>
                    <div className="text-4xl font-black text-red-900">{worker.weekTotals.בשרי}</div>
                  </div>
                  
                  <div className="text-center bg-white rounded-lg p-4 border-2 border-blue-300 shadow-sm">
                    <div className="text-sm text-blue-700 font-bold mb-1">חלבי</div>
                    <div className="text-4xl font-black text-blue-900">{worker.weekTotals.חלבי}</div>
                  </div>
                  
                  <div className="text-center bg-white rounded-lg p-4 border-2 border-green-300 shadow-sm">
                    <div className="text-sm text-green-700 font-bold mb-1">פרווה</div>
                    <div className="text-4xl font-black text-green-900">{worker.weekTotals.פרווה}</div>
                  </div>
                </div>
              </div>

              {/* פוטר */}
              <div className="mt-8 pt-4 border-t border-slate-300 text-center">
                <p className="text-xs text-slate-400">
                  צפורי אירוח ואירועים • {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: he })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StaffPrintView;