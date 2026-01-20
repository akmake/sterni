import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import { Save, FolderOpen, Trash2, X } from 'lucide-react';
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
      const res = await axios.get('/api/quotes', { withCredentials: true }); 
      // טיפול גמיש בתשובה שמגיעה מהשרת
      const files = res.data.data?.quotes || res.data || [];
      setSavedFiles(Array.isArray(files) ? files : []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage('לא הצלחתי לטעון את הרשימה');
      setLoading(false);
    }
  };

  // --- שמירה: התיקון היחיד הוא הוספת ה-Token ---
  const handleSave = async () => {
    if (!saveName) {
        toast.error('חובה לתת שם להצעה');
        return;
    }
    
    try {
      setLoading(true);

      // 1. מבקש את המפתח
      const { data: csrfData } = await axios.get('/api/csrf-token', { withCredentials: true });

      // 2. שולח את הנתונים בדיוק כמו שהשרת שלך רגיל לקבל (Name + Content)
      await axios.post('/api/quotes', {
        name: saveName,
        content: currentData 
      }, { 
        withCredentials: true,
        headers: {
            'X-CSRF-Token': csrfData.csrfToken // המפתח לדלת
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
      const res = await axios.get(`/api/quotes/${identifier}`, { withCredentials: true });
      
      // חילוץ התוכן נקי
      const loadedContent = res.data.data?.quote?.content || res.data.content;
      
      if (loadedContent) {
        onLoadData(loadedContent); 
        setIsOpen(false);
        setMode(null);
        toast.success('ההצעה נטענה');
      } else {
        toast.error('הקובץ ריק');
      }
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
      // גם למחיקה צריך מפתח
      const { data: csrfData } = await axios.get('/api/csrf-token', { withCredentials: true });

      await axios.delete(`/api/quotes/${identifier}`, { 
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

  const openSave = () => { setMode('save'); setIsOpen(true); setMessage(''); };
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
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">
                {mode === 'save' ? 'שמירת הצעה' : 'טעינת הצעה'}
              </h3>
              <button onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            {message && <div className="bg-yellow-100 p-2 text-sm mb-2 rounded text-center">{message}</div>}

            {mode === 'save' ? (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">שם הקובץ:</label>
                <input 
                  type="text" 
                  value={saveName} 
                  onChange={(e) => setSaveName(e.target.value)}
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="לדוגמה: חתונת משפחת כהן"
                />
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
                    <div>
                      <div className="font-bold text-sm">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('he-IL') : ''}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, file._id || file.name)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-2"
                    >
                      <Trash2 size={16} />
                    </button>
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