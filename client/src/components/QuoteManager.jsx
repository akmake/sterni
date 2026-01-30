import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import { Save, FolderOpen, Trash2, X, CalendarPlus, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const QuoteManager = ({ currentData, onLoadData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(null); // 'save' or 'load'
  const [saveName, setSaveName] = useState('');
  const [savedFiles, setSavedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // שליפת רשימת הקבצים
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/quotes', { withCredentials: true }); 
      const files = res.data.data?.quotes || res.data || [];
      setSavedFiles(Array.isArray(files) ? files : []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage('לא הצלחתי לטעון את הרשימה');
      setLoading(false);
    }
  };

  // --- שמירה (מבוסס על הקוד שעובד לך + הנתונים החדשים) ---
  const handleSave = async () => {
    if (!saveName) {
        toast.error('חובה לתת שם להצעה');
        return;
    }
    
    try {
      setLoading(true);

      // 1. מבקש את המפתח (תוקן ל-/api/csrf-token כפי שביקשת)
      const { data: csrfData } = await axios.get('http://localhost:5000/api/csrf-token', { withCredentials: true });

      // 2. שולח את הנתונים (הוספנו כאן את פרטי ה-CRM כדי שיישמרו)
      await axios.post('http://localhost:5000/api/quotes', {
        name: saveName,
        content: currentData.blocks, // התוכן הויזואלי
        
        // --- הנתונים שחסרים לך כדי ליצור קבוצה אחר כך ---
        clientName: currentData.clientName,
        contactPerson: {
            name: currentData.contactName,
            phone: currentData.contactPhone,
            email: currentData.contactEmail
        },
        dates: {
            from: currentData.arrivalDate,
            to: currentData.departureDate
        },
        pax: currentData.minPax,
        eventType: currentData.eventType
        // ------------------------------------------------
      }, { 
        withCredentials: true,
        headers: {
            'X-CSRF-Token': csrfData.csrfToken
        }
      });

      toast.success('נשמר בהצלחה!');
      setIsOpen(false);
      setSaveName('');
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || 'שגיאה בשמירה';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // טעינת קובץ
  const handleLoad = async (identifier) => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/api/quotes/${identifier}`, { withCredentials: true });
      
      const fullQuote = res.data.data?.quote || res.data;
      
      // הכנת הנתונים לטעינה (כולל השדות החדשים)
      const dataToLoad = {
         blocks: fullQuote.content, // במקרה ששמרנו במבנה החדש
         // אם זה קובץ ישן, ננסה לטעון אותו ישירות, אם חדש - נפרק
         clientName: fullQuote.clientName || fullQuote.name,
         contactName: fullQuote.contactPerson?.name || '',
         contactPhone: fullQuote.contactPerson?.phone || '',
         contactEmail: fullQuote.contactPerson?.email || '',
         arrivalDate: fullQuote.dates?.from ? fullQuote.dates.from.split('T')[0] : '',
         departureDate: fullQuote.dates?.to ? fullQuote.dates.to.split('T')[0] : '',
         minPax: fullQuote.pax || 0,
         eventType: fullQuote.eventType || ''
      };
      
      // תמיכה לאחור בקבצים ישנים ששמרו את הכל ב-content
      if (!fullQuote.content && fullQuote.blocks) {
          // מבנה ישן מאוד? ננסה להתאים
          onLoadData(fullQuote);
      } else {
          // מבנה חדש או מבנה שהקוד שלך שמר
          onLoadData(dataToLoad.blocks ? dataToLoad : fullQuote.content); 
      }

      setIsOpen(false);
      setMode(null);
      toast.success('ההצעה נטענה');
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בטעינת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  // מחיקת קובץ
  const handleDelete = async (e, identifier) => {
    e.stopPropagation();
    if(!window.confirm('למחוק את הקובץ?')) return;
    try {
      const { data: csrfData } = await axios.get('http://localhost:5000/api/csrf-token', { withCredentials: true });

      await axios.delete(`http://localhost:5000/api/quotes/${identifier}`, { 
        withCredentials: true,
        headers: {
            'X-CSRF-Token': csrfData.csrfToken
        }
      });
      toast.success('נמחק בהצלחה');
      fetchFiles(); 
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  // --- הפונקציה החדשה: המרה לקבוצה ---
  const handleConvertToGroup = async (e, quote) => {
    e.stopPropagation();
    if (!confirm(`האם ליצור קבוצה ביומן עבור "${quote.clientName || quote.name}"?`)) return;

    try {
      const { data: csrfData } = await axios.get('http://localhost:5000/api/csrf-token', { withCredentials: true });

      await axios.post(`http://localhost:5000/api/quotes/${quote.name}/convert`, {}, { 
          withCredentials: true,
          headers: { 'X-CSRF-Token': csrfData.csrfToken }
      });
      
      toast.success('הקבוצה נוצרה בהצלחה!');
      fetchFiles(); // רענון כדי לראות את הסימון הירוק
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'שגיאה ביצירת הקבוצה';
      toast.error(msg);
    }
  };

  const openSave = () => { 
      setMode('save'); 
      setIsOpen(true); 
      setMessage(''); 
      // אם יש כבר שם לקוח, נשתמש בו כשם ברירת מחדל לשמירה
      if (currentData.clientName && currentData.clientName !== 'שם הלקוח / הקבוצה') {
          setSaveName(currentData.clientName);
      }
  };
  
  const openLoad = () => { setMode('load'); setIsOpen(true); fetchFiles(); setMessage(''); };

  return (
    <div className="flex gap-2 print:hidden">
      <button 
        onClick={openSave}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition font-bold text-sm shadow-sm"
      >
        <Save size={16} /> שמור הצעה
      </button>
      
      <button 
        onClick={openLoad}
        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition font-bold text-sm shadow-sm"
      >
        <FolderOpen size={16} /> טען הצעה
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">
                {mode === 'save' ? 'שמירת הצעה' : 'טעינת הצעה'}
              </h3>
              <button onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            {message && <div className="bg-yellow-100 p-2 text-sm mb-2 rounded text-center">{message}</div>}

            {mode === 'save' ? (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">שם הקובץ (מזהה ייחודי):</label>
                <input 
                  type="text" 
                  value={saveName} 
                  onChange={(e) => setSaveName(e.target.value)}
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="לדוגמה: חתונת משפחת כהן"
                />
                 <div className="text-xs text-gray-500 mt-1">
                    * בעת השמירה, המערכת תשמור גם את פרטי אנשי הקשר והתאריכים לצורך יצירת קבוצה עתידית.
                 </div>
                <button 
                  onClick={handleSave} 
                  disabled={loading}
                  className="bg-green-600 text-white py-2 rounded mt-2 hover:bg-green-700 font-bold"
                >
                  {loading ? 'שומר...' : 'שמור כעת'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {loading && <p className="text-center text-gray-500">טוען רשימה...</p>}
                {!loading && savedFiles.length === 0 && <p className="text-center">אין קבצים שמורים</p>}
                
                {savedFiles.map((file) => (
                  <div 
                    key={file._id || file.quoteNumber} 
                    onClick={() => handleLoad(file.name)}
                    className="flex justify-between items-center p-3 border rounded hover:bg-blue-50 cursor-pointer group transition"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                          {file.clientName || file.name}
                          {file.isConverted && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-green-200">
                                  <CheckCircle size={10}/> הפך לקבוצה
                              </span>
                          )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('he-IL') : ''}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* הכפתור החדש ליצירת קבוצה */}
                        {!file.isConverted && (
                            <button 
                                onClick={(e) => handleConvertToGroup(e, file)}
                                title="צור קבוצה ביומן"
                                className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded border border-purple-100 transition"
                            >
                                <CalendarPlus size={16} />
                            </button>
                        )}

                        <button 
                        onClick={(e) => handleDelete(e, file._id || file.name)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition p-2"
                        >
                        <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteManager;