import React, { useState, useEffect, useRef } from 'react';
import api from '@/utils/api';
import { Save, FolderOpen, Trash2, X, CalendarPlus, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

/**
 * QuoteManager v2
 *
 * Props:
 *   currentData: { clientName, contactName, contactPhone, contactEmail, eventType, arrivalDate, departureDate, minPax, blocks }
 *   onLoadData: (data) => void
 *   containerRef: React ref to the quote container (for capturing HTML body)
 *   getLatestBlocks: () => blocks[] — reads contentEditable DOM to get current text
 */
const QuoteManager = ({ currentData, onLoadData, containerRef, getLatestBlocks }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(null); // 'save', 'load', or 'preview'
  const [saveName, setSaveName] = useState('');
  const [savedFiles, setSavedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ★ Keep a ref to the latest currentData so handleSave always reads fresh state
  const currentDataRef = useRef(currentData);
  useEffect(() => { currentDataRef.current = currentData; }, [currentData]);
  const [previewHtml, setPreviewHtml] = useState('');

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotes');
      const files = res.data.data?.quotes || res.data || [];
      setSavedFiles(Array.isArray(files) ? files : []);
    } catch (err) {
      console.error(err);
      setMessage('לא הצלחתי לטעון את הרשימה');
    } finally {
      setLoading(false);
    }
  };

  // ★ Capture the rendered HTML body from the container
  const captureHtmlBody = () => {
    if (!containerRef?.current) return '';
    const pages = containerRef.current.querySelectorAll('.quote-page');
    if (!pages.length) return '';

    // Clone and clean up for storage
    let html = '';
    pages.forEach((page) => {
      const clone = page.cloneNode(true);
      // Remove no-print elements (buttons, inserters, etc.)
      clone.querySelectorAll('.no-print, .inserter-line, button').forEach((el) => el.remove());
      // Remove contenteditable attributes
      clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
      html += clone.outerHTML;
    });
    return html;
  };

  // --- Save ---
  const handleSave = async () => {
    if (!saveName) {
      toast.error('חובה לתת שם להצעה');
      return;
    }

    try {
      setLoading(true);

      // ★ Read the ACTUAL content directly from the DOM — this captures all edits,
      // even text typed in contentEditable fields that haven't been blurred yet
      const latestBlocks = getLatestBlocks ? getLatestBlocks() : currentDataRef.current.blocks;
      const data = currentDataRef.current;

      const { data: csrfData } = await api.get('/csrf-token');

      // ★ Capture HTML body before saving
      const htmlBody = captureHtmlBody();

      await api.post('/quotes', {
        name: saveName,
        content: latestBlocks,
        clientName: data.clientName,
        contactPerson: {
          name: data.contactName,
          phone: data.contactPhone,
          email: data.contactEmail
        },
        dates: {
          from: data.arrivalDate,
          to: data.departureDate
        },
        pax: data.minPax,
        eventType: data.eventType,
        htmlBody  // ★ Send the full HTML body
      }, {
        headers: { 'X-CSRF-Token': csrfData.csrfToken }
      });

      toast.success('נשמר בהצלחה!');
      setIsOpen(false);
      setSaveName('');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'שגיאה בשמירה');
    } finally {
      setLoading(false);
    }
  };

  // --- Load ---
  const handleLoad = async (identifier) => {
    try {
      setLoading(true);
      const res = await api.get(`/quotes/${identifier}`);
      const fullQuote = res.data.data?.quote || res.data;

      const dataToLoad = {
        blocks: fullQuote.content,
        clientName: fullQuote.clientName || fullQuote.name,
        contactName: fullQuote.contactPerson?.name || '',
        contactPhone: fullQuote.contactPerson?.phone || '',
        contactEmail: fullQuote.contactPerson?.email || '',
        arrivalDate: fullQuote.dates?.from ? fullQuote.dates.from.split('T')[0] : '',
        departureDate: fullQuote.dates?.to ? fullQuote.dates.to.split('T')[0] : '',
        minPax: fullQuote.pax || 0,
        eventType: fullQuote.eventType || ''
      };

      onLoadData(dataToLoad);

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

  // ★ Preview saved HTML body
  const handlePreview = async (identifier) => {
    try {
      setLoading(true);
      const res = await api.get(`/quotes/${identifier}`);
      const fullQuote = res.data.data?.quote || res.data;

      if (fullQuote.htmlBody) {
        setPreviewHtml(fullQuote.htmlBody);
        setMode('preview');
      } else {
        toast('אין תצוגת HTML שמורה להצעה זו. שמור מחדש כדי ליצור אחת.');
      }
    } catch (err) {
      toast.error('שגיאה בטעינת התצוגה');
    } finally {
      setLoading(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (e, identifier) => {
    e.stopPropagation();
    if (!window.confirm('למחוק את הקובץ?')) return;
    try {
      const { data: csrfData } = await api.get('/csrf-token');
      await api.delete(`/quotes/${identifier}`, {
        headers: { 'X-CSRF-Token': csrfData.csrfToken }
      });
      toast.success('נמחק בהצלחה');
      fetchFiles();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  // --- Convert to group ---
  const handleConvertToGroup = async (e, quote) => {
    e.stopPropagation();
    if (!confirm(`האם ליצור קבוצה ביומן עבור "${quote.clientName || quote.name}"?`)) return;

    try {
      const { data: csrfData } = await api.get('/csrf-token');
      await api.post(`/quotes/${quote.name}/convert`, {}, {
        headers: { 'X-CSRF-Token': csrfData.csrfToken }
      });
      toast.success('הקבוצה נוצרה בהצלחה!');
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה ביצירת הקבוצה');
    }
  };

  const openSave = () => {
    setMode('save');
    setIsOpen(true);
    setMessage('');
    if (currentData.clientName && currentData.clientName !== 'שם הלקוח / הקבוצה') {
      setSaveName(currentData.clientName);
    }
  };

  const openLoad = () => {
    setMode('load');
    setIsOpen(true);
    fetchFiles();
    setMessage('');
  };

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
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-[550px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">
                {mode === 'save' ? 'שמירת הצעה' : mode === 'preview' ? 'תצוגת הצעה שמורה' : 'טעינת הצעה'}
              </h3>
              <button onClick={() => { setIsOpen(false); setMode(null); setPreviewHtml(''); }}>
                <X size={20} />
              </button>
            </div>

            {message && (
              <div className="bg-yellow-100 p-2 text-sm mb-2 rounded text-center">{message}</div>
            )}

            {/* ── SAVE MODE ── */}
            {mode === 'save' && (
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
                  * המערכת תשמור גם את פרטי אנשי הקשר, התאריכים, <strong>ואת כל תוכן ההצעה</strong> לצורך עיון עתידי.
                </div>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-green-600 text-white py-2 rounded mt-2 hover:bg-green-700 font-bold disabled:opacity-50"
                >
                  {loading ? 'שומר...' : 'שמור כעת'}
                </button>
              </div>
            )}

            {/* ── LOAD MODE ── */}
            {mode === 'load' && (
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
                            <CheckCircle size={10} /> הפך לקבוצה
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('he-IL') : ''}</span>
                        {file.eventType && <span>· {file.eventType}</span>}
                        {file.pax > 0 && <span>· {file.pax} משתתפים</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* ★ Preview button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreview(file.name); }}
                        title="תצוגה מקדימה"
                        className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded border border-slate-100 transition opacity-0 group-hover:opacity-100"
                      >
                        <Eye size={16} />
                      </button>

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

            {/* ★ PREVIEW MODE */}
            {mode === 'preview' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setMode('load'); setPreviewHtml(''); }}
                  className="text-sm text-blue-600 hover:underline self-start"
                >
                  ← חזרה לרשימה
                </button>
                <div
                  className="border rounded-lg overflow-auto max-h-[60vh] bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteManager;