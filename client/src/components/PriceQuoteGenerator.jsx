import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Printer, Trash2, Table as TableIcon, Type, FileDown, LoaderCircle, Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, List, ListOrdered, MousePointerClick, Send, Mail, User, Phone, Calendar, Users, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import api from '@/utils/api';
import QuoteManager from './QuoteManager';
import QuoteDatePicker from './QuoteDatePicker';

// --- הגדרות A4 ---
const A4_HEIGHT_PX = 1123;
const PAGE_MARGIN_Y = 140;
const CONTENT_HEIGHT = A4_HEIGHT_PX - PAGE_MARGIN_Y;
const GOLD = '#C5A059';

const printStyles = `
  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .quote-page {
        width: 210mm !important;
        height: 297mm !important;
        overflow: hidden !important;
        page-break-after: always;
        break-after: page;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
    }
    button { display: none !important; }
    .inserter-line { display: none !important; }
    [contenteditable] { outline: none !important; }
    input { border: none !important; background: transparent !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

// --- רכיב אינפוט שקוף לעריכה ידנית ---
const TransparentInput = ({ value, onChange, className, placeholder, style }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`bg-transparent border-none outline-none p-0 m-0 w-full placeholder:text-gray-300 focus:ring-0 ${className}`}
    placeholder={placeholder}
    style={{ font: 'inherit', color: 'inherit', letterSpacing: 'inherit', ...style }}
  />
);

// --- פונקציות עזר לתאריכים ---
import { toGematria } from '../utils/hebrewDate';

const formatEventDateDayHebrew = (dateInput) => {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;

    const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
    const parts = new Intl.DateTimeFormat('he-IL', { calendar: 'hebrew', day: 'numeric', month: 'long' }).formatToParts(date);
    const hDay = parts.find(p => p.type === 'day')?.value;
    const hMonth = parts.find(p => p.type === 'month')?.value;
    const hDayGematria = isNaN(hDay) ? hDay : toGematria(parseInt(hDay));
    const gregDate = date.toLocaleDateString('en-GB');

    return `${dayName}, ${hDayGematria} ${hMonth} (${gregDate})`;
};

// --- רכיב הוספה ---
const Inserter = ({ onAddText, onAddTable }) => (
    <div className="inserter-line group flex items-center justify-center h-4 -my-2 hover:my-1 transition-all cursor-pointer z-10 relative no-print">
        <div className="absolute w-full h-[2px] bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="bg-blue-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all transform scale-0 group-hover:scale-100 flex gap-2 shadow-xl relative z-20">
            <button onClick={onAddText} className="flex items-center gap-1 px-3 py-1 hover:bg-blue-700 rounded-full text-xs font-bold"><Type size={14}/> טקסט</button>
            <div className="w-[1px] bg-blue-400 h-4 self-center"></div>
            <button onClick={onAddTable} className="flex items-center gap-1 px-3 py-1 hover:bg-blue-700 rounded-full text-xs font-bold"><TableIcon size={14}/> טבלה</button>
        </div>
    </div>
);

// --- תפריט קליק ימני ---
const RichTextMenu = ({ position, onClose, onAction, type }) => {
    if (!position) return null;
    return (
        <div
            className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex flex-col gap-1 w-56 text-sm text-right"
            style={{ top: position.y, left: position.x, direction: 'rtl' }}
        >
            <div className="flex justify-between border-b pb-2 mb-1 gap-1">
                <button onClick={() => onAction('bold')} className="p-1 hover:bg-gray-100 rounded" title="הדגשה"><Bold size={16}/></button>
                <button onClick={() => onAction('italic')} className="p-1 hover:bg-gray-100 rounded" title="נטוי"><Italic size={16}/></button>
                <button onClick={() => onAction('underline')} className="p-1 hover:bg-gray-100 rounded" title="קו תחתי"><Underline size={16}/></button>
                <div className="w-[1px] bg-gray-200 mx-1"></div>
                <button onClick={() => onAction('justifyRight')} className="p-1 hover:bg-gray-100 rounded"><AlignRight size={16}/></button>
                <button onClick={() => onAction('justifyCenter')} className="p-1 hover:bg-gray-100 rounded"><AlignCenter size={16}/></button>
                <button onClick={() => onAction('justifyLeft')} className="p-1 hover:bg-gray-100 rounded"><AlignLeft size={16}/></button>
            </div>

            <div className="flex gap-1 border-b pb-2 mb-1">
                <button onClick={() => onAction('insertUnorderedList')} className="p-1 hover:bg-gray-100 rounded w-full text-center flex justify-center"><List size={16}/></button>
                <button onClick={() => onAction('insertOrderedList')} className="p-1 hover:bg-gray-100 rounded w-full text-center flex justify-center"><ListOrdered size={16}/></button>
            </div>

            {type === 'table' && (
                <>
                    <div className="text-[10px] font-bold text-gray-400 mt-1">שורות</div>
                    <button onClick={() => onAction('addRowAbove')} className="text-right px-2 py-1 hover:bg-blue-50 rounded flex items-center justify-between"><span>הוסף שורה מעל</span></button>
                    <button onClick={() => onAction('addRowBelow')} className="text-right px-2 py-1 hover:bg-blue-50 rounded flex items-center justify-between"><span>הוסף שורה מתחת</span></button>
                    <button onClick={() => onAction('deleteRow')} className="text-right px-2 py-1 hover:bg-red-50 text-red-600 rounded flex items-center justify-between"><span>מחק שורה</span><Trash2 size={12}/></button>

                    <div className="text-[10px] font-bold text-gray-400 mt-1">עמודות</div>
                    <button onClick={() => onAction('addColRight')} className="text-right px-2 py-1 hover:bg-blue-50 rounded flex items-center justify-between"><span>הוסף עמודה מימין</span></button>
                    <button onClick={() => onAction('addColLeft')} className="text-right px-2 py-1 hover:bg-blue-50 rounded flex items-center justify-between"><span>הוסף עמודה משמאל</span></button>
                    <button onClick={() => onAction('deleteCol')} className="text-right px-2 py-1 hover:bg-red-50 text-red-600 rounded flex items-center justify-between"><span>מחק עמודה</span><Trash2 size={12}/></button>
                </>
            )}
        </div>
    );
};

const PriceQuoteGenerator = () => {
  const location = useLocation();
  const [clientName, setClientName] = useState('שם הלקוח / הקבוצה');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [eventType, setEventType] = useState('יום עיון');
  const [minPaxPrefix, setMinPaxPrefix] = useState('מינימום');
  const [minPaxSuffix, setMinPaxSuffix] = useState('משתתפים');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [rawArrivalDate, setRawArrivalDate] = useState('');
  const [rawDepartureDate, setRawDepartureDate] = useState('');
  const [minPax, setMinPax] = useState('0');
  const [quoteTitle, setQuoteTitle] = useState('הצעת מחיר');
  const [blocks, setBlocks] = useState([]);
  const [paginatedPages, setPaginatedPages] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const blockRefs = useRef({});
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setRawArrivalDate(todayStr);
    setRawDepartureDate(todayStr);
    setArrivalDate(formatEventDateDayHebrew(todayStr));
    setDepartureDate(formatEventDateDayHebrew(todayStr));

    const defaultTopNotes = `<b>תנאי האירוח:</b><br>
    • קפה / תה רץ ושתייה קרה (מים ותפוזים) לאורך היום - בכל זמן הנופש סמוך לאולם הפעילות.<br>
    • כיבוד קל בהגעה, עוגות ומאפים.<br>
    • ארוחת צהריים בשרית לפי החלטת המלון.<br>
    • אפשרויות חניה - חינם.<br>
    • המלון כולו נמצא בכל ימות השנה בהשגחת בד"ץ העדה החרדית ירושלים.`;

    const defaultBottomNotes = `<b>המחירים כוללים מע"מ והם נט למלון.</b><br>
    <b>ההזמנה תכנס לתוקף רק לאחר חתימה על חוזה זה ושליחה למייל חזרה.</b><br>
    <br>
    <b>תנאי תשלום וביטול:</b><br>
    • <b>התשלום: ביום ההגעה באשראי או יומיים לפני האירוח בהעברה בנקאית.</b><br>
    • פרטי בנק: בנק פועלים מס' 12, סניף 552, מס' חשבון 444571, ע"ש: ציפורי אירוח ואירועים בע"מ.<br>
    • ניתן לעדכן מס' סופי של המשתתפים עד 48 שעות לפני מועד ההגעה, אך לא יפחת ממספר המשתתפים המקורי בהסכם.<br>
    • ביטול ההזמנה מיום החתימה ועד 14 יום מיום ההגעה - ייגבה תשלום של 50% מעלות ההזמנה.<br>
    • ביטול ההזמנה בתוך 7-14 ימים מתאריך ההגעה - ייגבה תשלום של 75% מעלות ההזמנה.<br>
    • ביטול ההזמנה בתוך 7 ימים מיום ההגעה - ייגבה תשלום של 100% מעלות ההזמנה.<br>
    <br>
    <b>הערות נוספות:</b><br>
    • קבוצה המונה פחות מ-50 איש - עלות אולם פעילות 1000 ₪.<br>
    • יש להשאיר צ'ק פיקדון ע"ס 5,000 ₪ לכל נזק שייגרם.<br>
    • הצעת מחיר תקפה ל-3 ימים.`;

    setBlocks([
        { id: 'text-top', type: 'text', content: defaultTopNotes },
        {
        id: 'table-main',
        type: 'table',
        title: 'עלויות:',
        headers: [
            { title: 'פירוט', width: 55 },
            { title: 'עלות', width: 15 },
            { title: 'כמות', width: 10 },
            { title: 'סה"כ', width: 20 }
        ],
        rows: [['פירוט החבילה...', '0', '0', '0']]
        },
        { id: 'text-bottom', type: 'text', content: defaultBottomNotes }
    ]);
  }, []);

  useLayoutEffect(() => {
    if (!blocks.length) return;

    const newPages = [];
    let currentPage = [];
    let currentHeight = 350;

    blocks.forEach((block) => {
        const element = blockRefs.current[block.id];
        const blockHeight = element ? element.offsetHeight + 30 : 100;

        if (currentHeight + blockHeight > CONTENT_HEIGHT) {
            newPages.push(currentPage);
            currentPage = [block];
            currentHeight = 150 + blockHeight;
        } else {
            currentPage.push(block);
            currentHeight += blockHeight;
        }
    });

    if (currentPage.length > 0) newPages.push(currentPage);

    const signatureHeight = 200;
    if (newPages.length > 0 && currentHeight + signatureHeight > A4_HEIGHT_PX) {
        newPages.push([]);
    }

    if (JSON.stringify(newPages.map(p => p.map(b => b.id))) !== JSON.stringify(paginatedPages.map(p => p.map(b => b.id)))) {
        setPaginatedPages(newPages);
    }
  }, [blocks, paginatedPages.length]);

  const addBlock = (index, type) => {
    const newBlock = type === 'text'
        ? { id: crypto.randomUUID(), type: 'text', content: 'הקלד טקסט כאן...' }
        : {
            id: crypto.randomUUID(),
            type: 'table',
            title: 'טבלה חדשה',
            headers: [{ title: 'כותרת', width: 50 }, { title: 'כותרת', width: 50 }],
            rows: [['', '']]
          };
    const newBlocks = [...blocks];
    if (index === -1) newBlocks.unshift(newBlock);
    else newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
  };

  const removeBlock = (id) => {
    if(confirm('למחוק את החלק הזה?')) setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlock = (id, updates) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleContextMenu = (e, type, blockId, rowIndex = null, colIndex = null) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type,
          blockId,
          rowIndex,
          colIndex
      });
  };

  const executeAction = (action) => {
      const { blockId, rowIndex, colIndex } = contextMenu;
      const block = blocks.find(b => b.id === blockId);

      if (['bold', 'italic', 'underline', 'justifyLeft', 'justifyCenter', 'justifyRight', 'insertUnorderedList', 'insertOrderedList'].includes(action)) {
          document.execCommand(action, false, null);
      }

      if (block && block.type === 'table') {
          let newRows = [...block.rows];
          let newHeaders = [...block.headers];

          switch (action) {
              case 'addRowAbove':
                  newRows.splice(rowIndex, 0, new Array(block.headers.length).fill(''));
                  updateBlock(blockId, { rows: newRows });
                  break;
              case 'addRowBelow':
                  newRows.splice(rowIndex + 1, 0, new Array(block.headers.length).fill(''));
                  updateBlock(blockId, { rows: newRows });
                  break;
              case 'deleteRow':
                  newRows.splice(rowIndex, 1);
                  if (newRows.length === 0) newRows.push(new Array(block.headers.length).fill(''));
                  updateBlock(blockId, { rows: newRows });
                  break;
              case 'addColRight':
                  const width = Math.floor(100 / (newHeaders.length + 1));
                  newHeaders.forEach(h => h.width = width);
                  newHeaders.splice(colIndex, 0, { title: 'חדש', width });
                  newRows = newRows.map(r => { const nr = [...r]; nr.splice(colIndex, 0, ''); return nr; });
                  updateBlock(blockId, { headers: newHeaders, rows: newRows });
                  break;
               case 'addColLeft':
                  const width2 = Math.floor(100 / (newHeaders.length + 1));
                  newHeaders.forEach(h => h.width = width2);
                  newHeaders.splice(colIndex + 1, 0, { title: 'חדש', width: width2 });
                  newRows = newRows.map(r => { const nr = [...r]; nr.splice(colIndex + 1, 0, ''); return nr; });
                  updateBlock(blockId, { headers: newHeaders, rows: newRows });
                  break;
              case 'deleteCol':
                  if (newHeaders.length <= 1) return;
                  newHeaders.splice(colIndex, 1);
                  const newW = Math.floor(100 / newHeaders.length);
                  newHeaders.forEach(h => h.width = newW);
                  newRows = newRows.map(r => r.filter((_, i) => i !== colIndex));
                  updateBlock(blockId, { headers: newHeaders, rows: newRows });
                  break;
          }
      }
      setContextMenu(null);
  };

  const tableActions = {
      updateCell: (blockId, rIdx, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          const newRows = [...block.rows];
          newRows[rIdx][cIdx] = val;
          updateBlock(blockId, { rows: newRows });
      },
      updateHeaderTitle: (blockId, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          const newHeaders = [...block.headers];
          newHeaders[cIdx].title = val;
          updateBlock(blockId, { headers: newHeaders });
      },
      updateHeaderWidth: (blockId, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          const newHeaders = [...block.headers];
          newHeaders[cIdx].width = Number(val);
          updateBlock(blockId, { headers: newHeaders });
      }
  };

  const dataToSave = {
    clientName,
    contactName,
    contactPhone,
    contactEmail,
    eventType,
    arrivalDate: rawArrivalDate,
    departureDate: rawDepartureDate,
    minPax,
    quoteTitle,
    blocks
  };

  /**
   * ★ Read the ACTUAL current content from the DOM's contentEditable elements.
   * This ensures we capture every text change, even ones where onBlur hasn't fired yet.
   */
  const getLatestBlocks = () => {
    return blocks.map(block => {
      const el = blockRefs.current[block.id];
      if (!el) return block;

      if (block.type === 'text') {
        const editableDiv = el.querySelector('[contenteditable]');
        if (editableDiv) {
          return { ...block, content: editableDiv.innerHTML };
        }
      } else if (block.type === 'table') {
        // Read table title from the input
        const titleInput = el.querySelector('input');
        const title = titleInput ? titleInput.value : block.title;

        // Read headers from DOM
        const headers = [...block.headers];
        const headerEls = el.querySelectorAll('thead [contenteditable]');
        headerEls.forEach((headerEl, idx) => {
          if (idx < headers.length) {
            headers[idx] = { ...headers[idx], title: headerEl.innerText };
          }
        });

        // Read cells from DOM
        const rows = block.rows.map(r => [...r]);
        const rowEls = el.querySelectorAll('tbody tr');
        rowEls.forEach((rowEl, rIdx) => {
          if (rIdx < rows.length) {
            const cellEls = rowEl.querySelectorAll('[contenteditable]');
            cellEls.forEach((cellEl, cIdx) => {
              if (cIdx < rows[rIdx].length) {
                rows[rIdx][cIdx] = cellEl.innerText;
              }
            });
          }
        });

        return { ...block, title, headers, rows };
      }

      return block;
    });
  };

  const handleLoadData = (data) => {
    if (!data) return;
    if (data.clientName) setClientName(data.clientName);
    if (data.contactName) setContactName(data.contactName);
    if (data.contactPhone) setContactPhone(data.contactPhone);
    if (data.contactEmail) {
        setContactEmail(data.contactEmail);
        setTargetEmail(data.contactEmail);
    }
    if (data.eventType) setEventType(data.eventType);
    if (data.quoteTitle) setQuoteTitle(data.quoteTitle);

    if (data.dates) {
        const fromDate = data.dates.from ? new Date(data.dates.from).toISOString().split('T')[0] : '';
        const toDate = data.dates.to ? new Date(data.dates.to).toISOString().split('T')[0] : '';
        setRawArrivalDate(fromDate);
        setRawDepartureDate(toDate);
        setArrivalDate(formatEventDateDayHebrew(fromDate));
        setDepartureDate(formatEventDateDayHebrew(toDate));
    } else {
        if (data.arrivalDate) {
             if (data.arrivalDate.includes('-')) {
                 setRawArrivalDate(data.arrivalDate);
                 setArrivalDate(formatEventDateDayHebrew(data.arrivalDate));
             } else {
                 setArrivalDate(data.arrivalDate);
             }
        }
        if (data.departureDate) {
             if (data.departureDate.includes('-')) {
                 setRawDepartureDate(data.departureDate);
                 setDepartureDate(formatEventDateDayHebrew(data.departureDate));
             } else {
                 setDepartureDate(data.departureDate);
             }
        }
    }

    if (data.minPax) setMinPax(data.minPax);
    if (data.blocks != null) setBlocks(data.blocks);

    toast.success('הצעה נטענה בהצלחה!');
  };

  // ★ Auto-load quote when navigated from calendar or other page with loadQuote state
  useEffect(() => {
    const quoteName = location.state?.loadQuote;
    if (!quoteName) return;

    const autoLoad = async () => {
      try {
        const res = await api.get(`/quotes/${quoteName}`);
        const fullQuote = res.data.data?.quote || res.data;

        const dataToLoad = {
          blocks: fullQuote.content,
          clientName: fullQuote.clientName || fullQuote.name,
          contactName: fullQuote.contactPerson?.name || '',
          contactPhone: fullQuote.contactPerson?.phone || '',
          contactEmail: fullQuote.contactPerson?.email || '',
          dates: fullQuote.dates,
          minPax: fullQuote.pax || 0,
          eventType: fullQuote.eventType || ''
        };

        handleLoadData(dataToLoad);
      } catch (err) {
        console.error('Auto-load quote failed:', err);
        toast.error('שגיאה בטעינת הצעת המחיר');
      }
    };

    autoLoad();
    // Clear the state so refreshing doesn't re-load
    window.history.replaceState({}, document.title);
  }, [location.state?.loadQuote]);

  const createPDFDocument = async () => {
    if (!containerRef.current) return null;

    const pdf = new jsPDF('p', 'mm', 'a4', true);
    const pdfWidth = 210;
    const pdfHeight = 297;

    const pageElements = containerRef.current.querySelectorAll('.quote-page');

    for (let i = 0; i < pageElements.length; i++) {
        const element = pageElements[i];

        const dataUrl = await htmlToImage.toJpeg(element, {
            quality: 0.75,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            width: 794,
            height: 1123,
            fontEmbedCSS: '',
            style: {
                margin: 0,
                transform: 'none',
                display: 'flex',
                flexDirection: 'column'
            },
            filter: (node) => !node.classList?.contains('no-print')
        });

        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }
    return pdf;
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading('מייצר PDF להורדה...');

    try {
        const pdf = await createPDFDocument();
        if (pdf) {
            pdf.save(`הצעת_מחיר_${clientName.replace(/[^a-zA-Z0-9א-ת]/g, '_')}.pdf`);
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
        formData.append('file', pdfBlob, `document_${Date.now()}.pdf`);
        formData.append('displayFilename', `הצעת מחיר - ${clientName}${contactName ? ` - ${contactName}` : ''}.pdf`);
        formData.append('email', targetEmail);
        formData.append('subject', `הצעת מחיר - ${clientName}`);
        formData.append('body', `שלום רב,\n\nמצורפת הצעת מחיר עבור ${clientName}.\n\nבברכה,\nצוות ציפורי.`);

        await api.post('/emails/send-attachment', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('המייל נשלח בהצלחה!', { id: toastId });

    } catch (err) {
        console.error(err);
        toast.error('שגיאה בשליחה: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden font-sans text-slate-800">
      <style>{printStyles}</style>

      {contextMenu && (
          <RichTextMenu
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            onAction={executeAction}
            type={contextMenu.type}
          />
      )}

      <div className="shrink-0 bg-white z-50 shadow-sm border-b h-16 flex items-center justify-between px-8 no-print">
         <div className="font-bold text-gray-700 text-lg flex items-center gap-2">
            <FileDown className="text-amber-500"/> מחולל הצעות
         </div>

         <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-md border border-blue-100 mx-4">
            <Mail size={16} className="text-blue-500"/>
            <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="מייל לשליחה..."
                className="bg-transparent text-sm outline-none w-48 text-blue-900 placeholder:text-blue-300"
            />
            <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
                {isSending ? <LoaderCircle className="animate-spin" size={14}/> : <Send size={14}/>}
                שלח
            </button>
         </div>

         <div className="flex gap-3 items-center">
             {/* ★ שינוי: containerRef מועבר ל-QuoteManager */}
             <QuoteManager
                currentData={dataToSave}
                onLoadData={handleLoadData}
                containerRef={containerRef}
                getLatestBlocks={getLatestBlocks}
             />

             <div className="h-6 w-[1px] bg-gray-300 mx-2"></div>

             <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 font-bold text-sm shadow-sm">
                 {isDownloading ? <LoaderCircle className="animate-spin" size={16}/> : <FileDown size={16}/>} הורד PDF
             </button>
             <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 font-bold text-sm shadow-sm"><Printer size={16}/> הדפס</button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">

        <div className="w-80 bg-white border-l border-gray-200 shadow-xl overflow-y-auto shrink-0 flex flex-col no-print z-40">
            <div className="p-5 space-y-6">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <User size={20} className="text-blue-600"/>
                    פרטי ההזמנה
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">שם הלקוח / הקבוצה</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            value={clientName === 'שם הלקוח / הקבוצה' ? '' : clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="הזן שם לקוח..."
                        />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">איש קשר</label>
                        <div className="flex items-center bg-white border rounded px-2">
                            <User size={14} className="text-gray-400 ml-2"/>
                            <input
                                type="text"
                                className="w-full p-2 outline-none text-sm"
                                placeholder="שם מלא"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center bg-white border rounded px-2">
                            <Phone size={14} className="text-gray-400 ml-2"/>
                            <input
                                type="text"
                                className="w-full p-2 outline-none text-sm"
                                placeholder="טלפון"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center bg-white border rounded px-2">
                            <Mail size={14} className="text-gray-400 ml-2"/>
                            <input
                                type="text"
                                className="w-full p-2 outline-none text-sm"
                                placeholder="אימייל"
                                value={contactEmail}
                                onChange={(e) => {
                                    setContactEmail(e.target.value);
                                    setTargetEmail(e.target.value);
                                }}
                            />
                        </div>
                    </div>

                    {/* ★ שינוי: QuoteDatePicker במקום input type="date" רגילים */}
                    <div className="space-y-3 pt-2 border-t">
                        <QuoteDatePicker
                            rawArrivalDate={rawArrivalDate}
                            rawDepartureDate={rawDepartureDate}
                            arrivalDateDisplay={arrivalDate}
                            departureDateDisplay={departureDate}
                            formatDateHebrew={formatEventDateDayHebrew}
                            onDatesChange={({ rawArrival, rawDeparture, arrivalDisplay, departureDisplay }) => {
                                setRawArrivalDate(rawArrival);
                                setRawDepartureDate(rawDeparture);
                                setArrivalDate(arrivalDisplay);
                                setDepartureDate(departureDisplay);
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">סוג פעילות</label>
                            <div className="flex items-center bg-white border rounded px-1">
                                <FileText size={14} className="text-gray-400 ml-1"/>
                                <input
                                    type="text"
                                    className="w-full p-1.5 outline-none text-sm"
                                    value={eventType}
                                    onChange={(e) => setEventType(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">כמות משתתפים</label>
                            <div className="flex items-center bg-white border rounded px-1">
                                <Users size={14} className="text-gray-400 ml-1"/>
                                <input
                                    type="number"
                                    className="w-full p-1.5 outline-none text-sm"
                                    value={minPax}
                                    onChange={(e) => setMinPax(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-amber-50 p-3 rounded text-xs text-amber-800 border border-amber-200">
                    <p><strong>שים לב:</strong> הנתונים שמוזנים כאן נכנסים אוטומטית לתוך המסמך משמאל ונשמרים במערכת בעת שמירת ההצעה.</p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-slate-100" ref={containerRef}>

            <div className="flex flex-col items-center gap-8 w-fit">

            {paginatedPages.map((pageBlocks, pageIndex) => (
                <div key={pageIndex} className="quote-page bg-white w-[210mm] h-[297mm] relative shadow-2xl p-[15mm] flex flex-col mx-auto transition-transform">

                    {pageIndex === 0 ? (
                        <header className="border-b-[3px] pb-4 mb-6" style={{ borderColor: GOLD }}>
                            <div className="flex justify-between items-start">
                                <div className="text-right pt-2 w-[55%]">
                                    <div className="text-sm font-bold mb-2 text-gray-500">בס"ד</div>

                                    <div className="text-2xl font-bold mb-2 text-slate-900 flex items-center gap-1">
                                        <span>לכבוד:  </span>
                                        <TransparentInput
                                            value={clientName}
                                            onChange={setClientName}
                                            className="font-bold text-slate-900"
                                        />
                                    </div>

                                    <div className="text-slate-700 text-base space-y-1 mb-4">
                                        <TransparentInput value={contactName} onChange={setContactName} className="font-medium" placeholder="שם איש קשר" />
                                        <TransparentInput value={contactPhone} onChange={setContactPhone} placeholder="טלפון" />
                                        <TransparentInput value={contactEmail} onChange={setContactEmail} placeholder="מייל" />
                                    </div>

                                    <div className="mt-4 text-sm space-y-1">
                                        <div className="text-slate-900 flex">
                                            <span className="font-bold ml-1 min-w-[70px]">סוג פעילות:</span>
                                            <TransparentInput value={eventType} onChange={setEventType} />
                                        </div>
                                        <div className="text-slate-900 flex">
                                            <span className="font-bold ml-1">הגעה:</span>
                                            <TransparentInput value={arrivalDate} onChange={setArrivalDate} />
                                        </div>
                                        <div className="text-slate-900 flex">
                                            <span className="font-bold ml-1">עזיבה:</span>
                                            <TransparentInput value={departureDate} onChange={setDepartureDate} />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-left w-[45%] flex flex-col items-end">
                                    <img src="/pop.png" alt="Logo" className="h-32 object-contain mb-3" />
                                </div>
                            </div>

{/* אזור כותרת מרכזית */}
                            <div className="w-full flex flex-col items-center justify-center mt-6 mx-auto">

                                <input
                                    value={quoteTitle}
                                    onChange={(e) => setQuoteTitle(e.target.value)}
                                    className="text-5xl font-bold mb-1 text-center bg-transparent border-none outline-none w-full hover:opacity-80 focus:opacity-100 transition-opacity"
                                    style={{ color: GOLD, fontFamily: 'inherit' }}
                                />

                                <div className="flex items-center justify-center gap-1.5 mt-0 w-full">

                                    <TransparentInput
                                        value={minPaxPrefix}
                                        onChange={setMinPaxPrefix}
                                        className="text-lg font-bold text-slate-900 w-auto"
                                        style={{ textAlign: 'left', maxWidth: '120px' }}
                                        placeholder="טקסט התחלה"
                                    />

                                    <input
                                        type="text"
                                        value={minPax}
                                        onChange={(e) => setMinPax(e.target.value)}
                                        className="w-12 text-lg font-bold text-center bg-transparent border-b border-gray-300 outline-none p-0 focus:border-amber-500"
                                    />

                                    <TransparentInput
                                        value={minPaxSuffix}
                                        onChange={setMinPaxSuffix}
                                        className="text-lg font-bold text-slate-900 w-auto"
                                        style={{ textAlign: 'right', maxWidth: '120px' }}
                                        placeholder="טקסט סיום"
                                    />

                                </div>
                            </div>
                        </header>
                    ) : (
                        <div className="border-b mb-6 pb-2 flex justify-between text-gray-400 text-xs uppercase tracking-wider">
                            <span>המשך הצעה: {clientName}</span>
                            <span>עמוד {pageIndex + 1}</span>
                        </div>
                    )}

                    <div className="flex-grow flex flex-col">
                        {pageIndex === 0 && pageBlocks.length === 0 && (
                            <Inserter onAddText={() => addBlock(-1, 'text')} onAddTable={() => addBlock(-1, 'table')} />
                        )}

                        {pageBlocks.map((pageBlock) => {
                            const block = blocks.find(b => b.id === pageBlock.id) || pageBlock;
                            const realIndex = blocks.findIndex(b => b.id === block.id);
                            return (
                                <div key={block.id} ref={el => blockRefs.current[block.id] = el} className="relative group/block mb-4 transition-all">
                                    <button onClick={() => removeBlock(block.id)} className="absolute -right-10 top-0 text-gray-300 hover:text-red-500 no-print opacity-0 group-hover/block:opacity-100 transition-opacity p-2"><Trash2 size={16}/></button>

                                    {block.type === 'text' ? (
                                        <div
                                            contentEditable
                                            onContextMenu={(e) => handleContextMenu(e, 'text', block.id)}
                                            dangerouslySetInnerHTML={{ __html: block.content }}
                                            onBlur={(e) => updateBlock(block.id, { content: e.target.innerHTML })}
                                            className="w-full min-h-[2em] outline-none border border-transparent hover:border-blue-200 focus:border-blue-400 p-2 rounded transition-colors text-sm leading-relaxed whitespace-pre-wrap"
                                        />
                                    ) : (
                                        <div className="w-full border border-transparent hover:border-amber-200 rounded p-1 transition-colors relative group/table">
                                            <div className="no-print absolute -top-5 left-0 text-[10px] text-gray-400 bg-white border px-2 rounded opacity-0 group-hover/table:opacity-100 transition-opacity flex items-center gap-1">
                                                <MousePointerClick size={10}/> לחיצה ימנית לעריכה מתקדמת
                                            </div>

                                            <div className="flex justify-between items-end mb-2">
                                                <input
                                                    value={block.title || ''}
                                                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                                    className="font-bold text-slate-700 text-base bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 outline-none px-1 w-full"
                                                    placeholder="כותרת טבלה..."
                                                />
                                            </div>

                                            <table className="w-full border-collapse table-fixed">
                                                <thead>
                                                    <tr className="bg-white text-slate-700 border-b border-t border-slate-300" style={{ borderTopColor: GOLD, borderTopWidth: '2px' }}>
                                                        {block.headers.map((h, idx) => (
                                                            <th
                                                                key={idx}
                                                                className="border-l border-slate-200 p-2 align-bottom relative group/th bg-gray-50"
                                                                style={{ width: `${h.width}%` }}
                                                                onContextMenu={(e) => handleContextMenu(e, 'table', block.id, -1, idx)}
                                                            >
                                                                <div
                                                                    contentEditable
                                                                    suppressContentEditableWarning
                                                                    onBlur={(e) => tableActions.updateHeaderTitle(block.id, idx, e.target.innerText)}
                                                                    className="w-full bg-transparent text-center font-bold text-sm outline-none whitespace-normal break-words min-h-[1.5em]"
                                                                    dangerouslySetInnerHTML={{ __html: h.title }}
                                                                />
                                                                <div className="flex items-center justify-center gap-1 no-print opacity-0 group-hover/th:opacity-100 transition-opacity bg-white absolute bottom-full left-0 w-full z-10 shadow border p-1 rounded mb-1">
                                                                    <input type="number" value={h.width} onChange={(e) => tableActions.updateHeaderWidth(block.id, idx, e.target.value)} className="w-8 text-[10px] text-center border rounded bg-gray-50"/>
                                                                    <span className="text-[10px]">%</span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {block.rows.map((row, rIdx) => (
                                                        <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                                            {row.map((cell, cIdx) => (
                                                                <td
                                                                    key={cIdx}
                                                                    className="border-l border-slate-200 p-2 align-top relative"
                                                                    onContextMenu={(e) => handleContextMenu(e, 'table', block.id, rIdx, cIdx)}
                                                                >
                                                                    <div
                                                                        contentEditable
                                                                        suppressContentEditableWarning
                                                                        onBlur={(e) => tableActions.updateCell(block.id, rIdx, cIdx, e.target.innerText)}
                                                                        className="w-full min-h-[1.5em] outline-none whitespace-pre-wrap text-sm"
                                                                        dangerouslySetInnerHTML={{ __html: cell }}
                                                                    />
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <div className="absolute -bottom-4 left-0 w-full flex justify-center opacity-0 group-hover/block:opacity-100 transition-opacity z-20">
                                         <Inserter onAddText={() => addBlock(realIndex, 'text')} onAddTable={() => addBlock(realIndex, 'table')} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {pageIndex === paginatedPages.length - 1 && (
                        <div className="mt-auto pt-10 px-4 flex justify-between items-end pb-8 text-slate-800">
                            <div className="text-right text-sm leading-relaxed">
                                <div className="font-bold text-base" style={{ color: GOLD, borderColor: GOLD }}>בברכה,</div>
                                <div className="font-bold text-base">שטערני דהאן</div>
                                <div className="text-slate-600">08-8593775</div>
                                <div className="font-bold text-slate-800 mt-1">ציפורי אירוח ואירועים בע"מ</div>
                            </div>

                            <div className="text-center">
                                <div className="border-b border-black w-60 mb-2"></div>
                                <div className="font-bold text-base" style={{ color: GOLD, borderColor: GOLD }}>חתימה וחותמת</div>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            <div className="h-20"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PriceQuoteGenerator;