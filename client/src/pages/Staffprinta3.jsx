import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ArrowRight, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const StaffPrintAutoOnePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [staffData, setStaffData] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { reportData } = location.state || {};

  useEffect(() => {
    if (!reportData) return;

    // 1. קיבוץ נתונים
    const map = {};
    reportData.forEach(meal => {
      (meal.assignedStaff || []).forEach(name => {
        if (!map[name]) map[name] = [];
        map[name].push(meal);
      });
    });

    // 2. מיון
    const processed = Object.keys(map).map(name => ({
      name,
      meals: map[name].sort((a, b) => new Date(a.date) - new Date(b.date))
    }));

    setStaffData(processed);
  }, [reportData]);

  // --- האלגוריתם: חישוב גובה שורה ופונט לפי כמות הפריטים ---
  // A4 גובה נטו (בפיקסלים, פחות שוליים קטנים) הוא בערך 1050px
  const getDynamicStyle = (count) => {
    const totalHeight = 1050; 
    const calculatedRowHeight = Math.floor(totalHeight / (count || 1));
    
    // הגבלת גובה שורה (שלא יהיה מוגזם אם יש רק שורה אחת, ושלא יקרוס אם יש מליון)
    const rowHeight = Math.min(Math.max(calculatedRowHeight, 25), 150); 
    
    // חישוב גודל פונט יחסי לגובה השורה (בערך 40% מגובה השורה)
    const fontSize = Math.floor(rowHeight * 0.35);

    return {
      rowHeight: `${rowHeight}px`,
      fontSize: `${Math.min(fontSize, 30)}px`, // מקסימום פונט 30px
      padding: '0 10px'
    };
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 500));

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      for (let i = 0; i < staffData.length; i++) {
        const element = document.getElementById(`page-${i}`);
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          windowHeight: 1123
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(`דוח-ללא-כותרות-${format(new Date(), 'dd-MM')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('שגיאה');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!reportData) return <div>טוען...</div>;

  return (
    <div className="min-h-screen bg-gray-300 font-sans dir-rtl pb-20">
      
      {/* סרגל עליון (לא מודפס) */}
      <div className="fixed top-0 inset-x-0 bg-white shadow z-50 p-2 flex justify-between items-center print:hidden">
        <button onClick={() => navigate(-1)} className="font-bold px-4">חזרה</button>
        <div className="text-red-600 font-bold">מצב נקי - ללא כותרות - התאמה אוטומטית לדף</div>
        <button onClick={handleDownloadPDF} disabled={isGenerating} className="bg-black text-white px-6 py-2 rounded font-bold">
          {isGenerating ? <Loader2 className="animate-spin"/> : "הורד PDF"}
        </button>
      </div>

      {/* אזור העבודה */}
      <div className="mt-16 flex flex-col items-center gap-10">
        {staffData.map((staff, idx) => {
          // הפעלת החישוב לכל עובד בנפרד
          const style = getDynamicStyle(staff.meals.length);

          return (
            <div 
              key={idx}
              id={`page-${idx}`}
              className="bg-white mx-auto relative box-border overflow-hidden"
              // גודל A4 קשיח בפיקסלים
              style={{ width: '794px', height: '1123px', padding: '20px' }}
            >
              {/* אין כותרות עליונות! מתחילים ישר מהלולאה */}
              
              <div className="flex flex-col w-full h-full">
                {staff.meals.map((meal, mIdx) => {
                  const isNewDay = mIdx === 0 || 
                    format(new Date(meal.date), 'dd/MM') !== format(new Date(staff.meals[mIdx - 1].date), 'dd/MM');

                  return (
                    <React.Fragment key={mIdx}>
                      {/* מפריד ימים - דק מאוד */}
                      {isNewDay && (
                        <div 
                          className="w-full bg-black text-white px-2 font-bold flex items-center"
                          style={{ height: '25px', fontSize: '14px' }} // גובה קבוע מינימלי למפריד
                        >
                          {format(new Date(meal.date), 'EEEE dd/MM', { locale: he })}
                        </div>
                      )}

                      {/* השורה עצמה - גובה מחושב דינמית */}
                      <div 
                        className="flex items-center border-b border-gray-300 w-full"
                        style={{ 
                          height: style.rowHeight, 
                          fontSize: style.fontSize,
                          padding: style.padding 
                        }}
                      >
                        
                        {/* 1. שעה */}
                        <div className="w-[12%] font-mono font-bold shrink-0 border-l border-gray-200 pl-2">
                          {meal.startTime}
                        </div>

                        {/* 2. תפריט + הערות (באותה שורה!) */}
                        <div className="flex-1 px-3 font-bold text-black flex items-center overflow-hidden whitespace-nowrap">
                          <span className="truncate">{meal.menuItem}</span>
                          
                          {/* הערה - באדום, באותה שורה */}
                          {meal.manualNotes && (
                            <span className="mr-2 text-red-600 font-black shrink-0">
                              - {meal.manualNotes}
                            </span>
                          )}
                        </div>

                        {/* 3. מיקום */}
                        <div className="w-[20%] text-center text-gray-600 truncate px-2 border-r border-gray-200">
                          {meal.hall}
                        </div>

                        {/* 4. כמות */}
                        <div className="w-[8%] text-center font-bold px-1 border-r border-gray-200">
                          {meal.pax}
                        </div>
                        
                        {/* 5. כשרות */}
                        <div className={`w-[10%] text-center font-bold px-1 ${
                          meal.kosherType === 'בשרי' ? 'text-red-600' : 
                          meal.kosherType === 'חלבי' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {meal.kosherType || '-'}
                        </div>

                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* שם העובד בקטן למטה בצד (כדי שבכל זאת ידעו למי הדף שייך, אבל לא כותרת) */}
              <div className="absolute bottom-2 left-4 text-xs text-gray-300 font-mono">
                {staff.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffPrintAutoOnePage;