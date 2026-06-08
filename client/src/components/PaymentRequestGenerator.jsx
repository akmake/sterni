import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Save, Printer, Trash2, Table as TableIcon, Type, FileDown, LoaderCircle, Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, MousePointerClick, Plus, Send, Mail } from 'lucide-react';
import { useParams } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { toast } from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import api from '@/utils/api';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

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
    .inserter-bar { display: none !important; }
    [contenteditable] { outline: none !important; }
    input { border: none !important; background: transparent !important; outline: none !important; } 
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

// --- פונקציות עזר לתאריכים ---
import { toGematria, yearToGematria } from '../utils/hebrewDate';

// --- רכיב הוספה ---
const Inserter = ({ onAddText, onAddTable }) => (
    <div className="inserter-bar flex items-center justify-center py-2 group cursor-pointer no-print opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-full shadow-sm border">
            <button onClick={onAddText} className="flex items-center gap-1 px-3 py-1 hover:bg-blue-600 hover:text-white rounded-full text-xs font-bold transition-colors"><Type size={14}/> טקסט</button>
            <div className="w-[1px] bg-gray-300 h-4 self-center"></div>
            <button onClick={onAddTable} className="flex items-center gap-1 px-3 py-1 hover:bg-blue-600 hover:text-white rounded-full text-xs font-bold transition-colors"><TableIcon size={14}/> טבלה</button>
        </div>
    </div>
);

// --- תפריט קליק ימני ---
const RichTextMenu = ({ position, onClose, onAction, type }) => {
    if (!position) return null;
    return (
        <div 
            className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 p-2 flex flex-col gap-1 w-60 text-sm text-right font-sans"
            style={{ top: position.y, left: position.x, direction: 'rtl' }}
        >
            <div className="text-xs text-gray-400 font-bold px-2 pb-1">עיצוב</div>
            <div className="flex justify-between border-b pb-2 mb-1 gap-1">
                <button onClick={() => onAction('bold')} className="p-1 hover:bg-gray-100 rounded" title="הדגשה"><Bold size={16}/></button>
                <button onClick={() => onAction('italic')} className="p-1 hover:bg-gray-100 rounded" title="נטוי"><Italic size={16}/></button>
                <button onClick={() => onAction('underline')} className="p-1 hover:bg-gray-100 rounded" title="קו תחתי"><Underline size={16}/></button>
                <div className="w-[1px] bg-gray-200 mx-1"></div>
                <button onClick={() => onAction('justifyRight')} className="p-1 hover:bg-gray-100 rounded"><AlignRight size={16}/></button>
                <button onClick={() => onAction('justifyCenter')} className="p-1 hover:bg-gray-100 rounded"><AlignCenter size={16}/></button>
                <button onClick={() => onAction('justifyLeft')} className="p-1 hover:bg-gray-100 rounded"><AlignLeft size={16}/></button>
            </div>

            {type === 'table' && (
                <>
                    <div className="text-xs text-gray-400 font-bold px-2 mt-2 pb-1">שורות ועמודות</div>
                    <button onClick={() => onAction('addRowBelow')} className="text-right px-2 py-1.5 hover:bg-blue-50 text-blue-700 rounded flex items-center justify-between"><span>הוסף שורה מתחת</span><Plus size={14}/></button>
                    <button onClick={() => onAction('deleteRow')} className="text-right px-2 py-1.5 hover:bg-red-50 text-red-600 rounded flex items-center justify-between"><span>מחק שורה</span><Trash2 size={14}/></button>
                    <div className="border-t my-1"></div>
                    <button onClick={() => onAction('addColLeft')} className="text-right px-2 py-1.5 hover:bg-blue-50 text-blue-700 rounded flex items-center justify-between"><span>הוסף עמודה משמאל</span><Plus size={14}/></button>
                    <button onClick={() => onAction('deleteCol')} className="text-right px-2 py-1.5 hover:bg-red-50 text-red-600 rounded flex items-center justify-between"><span>מחק עמודה</span><Trash2 size={14}/></button>
                </>
            )}
            
            <button onClick={onClose} className="mt-2 text-center text-xs text-gray-400 hover:bg-gray-100 p-1 rounded">סגור תפריט</button>
        </div>
    );
};

const PaymentRequestGenerator = ({ groupId = null, onSave = null, paymentRequestId = null }) => {
  const params = useParams();
  const actualGroupId = groupId || params.groupId;
  const { groups, fetchGroups, updateGroup } = useGroupsStore();
  const group = actualGroupId ? groups.find(g => g._id === actualGroupId) : null;

  const [blocks, setBlocks] = useState([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [currency, setCurrency] = useState('ILS');
  
  const [headerDetails, setHeaderDetails] = useState({
      groupName: '',
      contactName: '',
      contactPhone: '',
      contactEmail: ''
  });

  const [paginatedPages, setPaginatedPages] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false); 
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  
  const [contextMenu, setContextMenu] = useState(null);

  const blockRefs = useRef({});
  const containerRef = useRef(null);
  const DRAFT_KEY = `draft_payment_${actualGroupId || paymentRequestId}`;

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // --- טעינת נתונים ---
  useEffect(() => {
    if (!actualGroupId && !paymentRequestId) {
      // Mode: דרישת תשלום חדשה ללא ייחוס לקבוצה - תמיד פותח טופס חדש ונקי
      initializeDefaultPaymentRequest({});
    } else if (actualGroupId && group) {
      // Mode: דרישת תשלום של קבוצה
      const savedDraft = localStorage.getItem(DRAFT_KEY);
        let loadedFromDraft = false;

        if (savedDraft) {
            try {
                const draftData = JSON.parse(savedDraft);
                const serverTime = group.paymentRequest?.lastUpdated ? new Date(group.paymentRequest.lastUpdated).getTime() : 0;
                
                if (draftData.timestamp > serverTime) {
                    setBlocks(draftData.blocks);
                    setOrderNumber(draftData.orderNumber);
                    setTargetEmail(draftData.targetEmail || group.contactPerson?.email || '');
                    setTotalAmount(draftData.totalAmount || 0);
                    setCurrency(draftData.currency || 'ILS');
                    
                    if (draftData.headerDetails) {
                        setHeaderDetails(draftData.headerDetails);
                    } else {
                        setHeaderDetails({
                            groupName: group.name,
                            contactName: group.contactPerson?.name || '',
                            contactPhone: group.contactPerson?.phone || '',
                            contactEmail: group.contactPerson?.email || ''
                        });
                    }

                    toast.success('טיוטה שלא נשמרה שוחזרה', { position: 'bottom-center', icon: '📝' });
                    loadedFromDraft = true;
                }
            } catch (e) {
                console.error("Error parsing draft", e);
            }
        }

        if (!loadedFromDraft) {
            if (group.paymentRequest?.blocks && group.paymentRequest.blocks.length > 0) {
                setBlocks(group.paymentRequest.blocks);
                setOrderNumber(group.paymentRequest.orderNumber || '');
                setTotalAmount(group.paymentRequest.totalAmount || 0);
                setCurrency(group.paymentRequest.currency || 'ILS');
                if (group.paymentRequest.headerDetails) {
                    setHeaderDetails(group.paymentRequest.headerDetails);
                } else {
                    setHeaderDetails({
                        groupName: group.name,
                        contactName: group.contactPerson?.name || '',
                        contactPhone: group.contactPerson?.phone || '',
                        contactEmail: group.contactPerson?.email || ''
                    });
                }
            } else {
                initializeDefaultPaymentRequest(group);
                setHeaderDetails({
                    groupName: group.name,
                    contactName: group.contactPerson?.name || '',
                    contactPhone: group.contactPerson?.phone || '',
                    contactEmail: group.contactPerson?.email || ''
                });
            }
            setTargetEmail(group.contactPerson?.email || '');
        }
    } else if (actualGroupId && !group) {
      fetchGroups();
    }
  }, [group, actualGroupId, paymentRequestId, DRAFT_KEY]);

  // --- שמירה אוטומטית (רק עבור קבוצה או דרישה קיימת, לא בטופס חיצוני חדש) ---
  useEffect(() => {
      if (blocks.length > 0 && (actualGroupId || paymentRequestId)) {
          const draftData = {
              blocks,
              orderNumber,
              targetEmail,
              headerDetails,
              totalAmount,
              currency,
              timestamp: Date.now()
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      }
  }, [blocks, orderNumber, targetEmail, headerDetails, totalAmount, currency, DRAFT_KEY, actualGroupId, paymentRequestId]);

  // --- פגינציה ---
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

  const initializeDefaultPaymentRequest = (groupData) => {
    const isLodging = groupData.startDate ? new Date(groupData.startDate).toDateString() !== new Date(groupData.endDate).toDateString() : false;
    const eventType = groupData.name ? (isLodging ? 'אירוח עם לינה' : 'יום עיון') : 'דרישת תשלום';

    let arrivalDate = groupData.startDate || new Date();
    if (groupData.events && groupData.events.length > 0) {
       const sorted = [...groupData.events].sort((a,b) => new Date(a.start) - new Date(b.start));
       arrivalDate = sorted[0].start;
    }
    
    const dateObj = new Date(arrivalDate);
    const dateGreg = dateObj.toLocaleDateString('en-GB');
    const parts = new Intl.DateTimeFormat('he-IL', { calendar: 'hebrew', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(dateObj);
    const hDay = parts.find(p => p.type === 'day')?.value;
    const hMonth = parts.find(p => p.type === 'month')?.value;
    const hYear = parts.find(p => p.type === 'year')?.value;
    const hDayGematria = isNaN(hDay) ? hDay : toGematria(parseInt(hDay));
    const hYearGematria = yearToGematria(hYear);
    const dateHeb = `${hDayGematria} ${hMonth} ${hYearGematria}`;

    const topContent = `אבקשכם להעביר תשלום בגין: <b>${eventType}</b><br>
בתאריך: <b>${dateHeb} (${dateGreg})</b>`;

    const bankDetails = `<b>בהעברה בנקאית לחשבוננו:</b><br>
ע"ש ציפורי אירוח ואירועים בע"מ<br>
מספר חשבון: 444571<br>
בנק פועלים מס' 12<br>
סניף 552 בני ברק<br>
לאחר ביצוע העברה נא לשלוח אסמכתא למייל: ziporihotell@gmai.com`;

    setBlocks([
      { id: 'text-intro', type: 'text', content: topContent },
      {
        id: 'table-payment',
        type: 'table',
        title: 'פירוט לתשלום:',
        headers: [
            { title: 'פירוט', width: 40 },
            { title: 'כמות', width: 20 },
            { title: 'עלות', width: 20 },
            { title: 'סה"כ', width: 20 }
        ],
        rows: [
            [`תשלום עבור ${eventType}`, groupData.pax?.toString() || '0', '0', '0'],
            ['סה"כ:', '', '', '0']
        ]
      },
      { id: 'text-bank', type: 'text', content: bankDetails }
    ]);
  };

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
    if(confirm('למחוק את החלק הזה?')) setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id, updates) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
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

  const calculateAndSetTable = (rows) => {
      const newRows = rows.map(r => [...r]);
      let grandTotal = 0;
      for(let i=0; i<newRows.length-1; i++) {
          const qty = parseFloat(String(newRows[i][1]).replace(/[^\d.-]/g, '')) || 0;
          const price = parseFloat(String(newRows[i][2]).replace(/[^\d.-]/g, '')) || 0;
          if(qty || price) {
              const rowTotal = qty * price;
              grandTotal += rowTotal;
              newRows[i][3] = rowTotal.toLocaleString('he-IL', { maximumFractionDigits: 2 });
          }
      }
      if (newRows.length > 0) {
          const lastIdx = newRows.length - 1;
          newRows[lastIdx][3] = grandTotal.toLocaleString('he-IL', { maximumFractionDigits: 2 });
      }
      return newRows;
  };

  const executeAction = (action) => {
      const { blockId, rowIndex, colIndex } = contextMenu;
      const block = blocks.find(b => b.id === blockId);

      if (['bold', 'italic', 'underline', 'justifyLeft', 'justifyCenter', 'justifyRight'].includes(action)) {
          document.execCommand(action, false, null);
      }

      if (block && block.type === 'table') {
          let newRows = block.rows.map(row => [...row]);
          let newHeaders = block.headers.map(header => ({ ...header }));

          switch (action) {
              case 'addRowBelow':
                  const insertIndex = rowIndex !== null ? rowIndex + 1 : newRows.length - 1;
                  newRows.splice(insertIndex, 0, new Array(block.headers.length).fill(''));
                  updateBlock(blockId, { rows: newRows });
                  break;
              case 'deleteRow':
                  if (newRows.length <= 1) return;
                  newRows.splice(rowIndex, 1);
                  if (block.headers.length === 4) newRows = calculateAndSetTable(newRows);
                  updateBlock(blockId, { rows: newRows });
                  break;
              case 'addColLeft':
                  const width = Math.floor(100 / (newHeaders.length + 1));
                  newHeaders.forEach(h => h.width = width);
                  newHeaders.splice(colIndex + 1, 0, { title: 'חדש', width });
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
        const titleInput = el.querySelector('input');
        const title = titleInput ? titleInput.value : block.title;

        const headers = block.headers.map(h => ({ ...h }));
        const headerEls = el.querySelectorAll('thead [contenteditable]');
        headerEls.forEach((headerEl, idx) => {
          if (idx < headers.length) {
            headers[idx] = { ...headers[idx], title: headerEl.innerText };
          }
        });

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

  const tableActions = {
      updateCell: (blockId, rIdx, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          let newRows = block.rows.map(row => [...row]);
          newRows[rIdx][cIdx] = val;
          if (block.headers.length === 4 && rIdx !== newRows.length - 1) {
             if (cIdx === 1 || cIdx === 2) {
                 newRows = calculateAndSetTable(newRows);
             }
          }
          updateBlock(blockId, { rows: newRows });
      },
      updateHeaderTitle: (blockId, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          const newHeaders = block.headers.map(h => ({ ...h }));
          newHeaders[cIdx].title = val;
          updateBlock(blockId, { headers: newHeaders });
      },
      updateHeaderWidth: (blockId, cIdx, val) => {
          const block = blocks.find(b => b.id === blockId);
          const newHeaders = block.headers.map(h => ({ ...h }));
          newHeaders[cIdx].width = Number(val);
          updateBlock(blockId, { headers: newHeaders });
      }
  };

  // --- ייצור PDF - העתק מדויק מהקוד שעובד ב-PriceQuoteGenerator ---
  const generatePDFBlob = async () => {
    if (!containerRef.current) return null;
    
    const pdf = new jsPDF('p', 'mm', 'a4', true);
    const pdfWidth = 210;
    const pdfHeight = 297;
    
    const pageElements = containerRef.current.querySelectorAll('.quote-page');

    for (let i = 0; i < pageElements.length; i++) {
        const element = pageElements[i];

        // *** שימוש בקונפיגורציה המדויקת מהקוד התקין ***
        const dataUrl = await htmlToImage.toJpeg(element, {
            quality: 0.75,
            pixelRatio: 2, 
            backgroundColor: '#ffffff',
            width: 794, 
            height: 1123, 
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
        const pdf = await generatePDFBlob();
        pdf.save(`דרישת_תשלום_${headerDetails.groupName.replace(/[^a-zA-Z0-9א-ת]/g, '_')}.pdf`);
        toast.success('הקובץ נוצר!', { id: toastId });
    } catch (err) {
        console.error(err);
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
        await handleSave(false); 

        const pdf = await generatePDFBlob();
        const pdfBlob = pdf.output('blob');

        const formData = new FormData();
        formData.append('file', pdfBlob, `document_${Date.now()}.pdf`);
        formData.append('displayFilename', `דרישת תשלום - ${headerDetails.groupName}${headerDetails.contactName ? ` - ${headerDetails.contactName}` : ''}.pdf`);
        formData.append('email', targetEmail);
        formData.append('subject', `דרישת תשלום - ${headerDetails.groupName}`);
        formData.append('body', `שלום רב,\n\nמצורפת דרישת תשלום עבור ${headerDetails.groupName}.\n\nבברכה,\nצוות ציפורי.`);

        await api.post('/emails/send-attachment', formData);
        toast.success('המייל נשלח בהצלחה!', { id: toastId });
        
        localStorage.removeItem(DRAFT_KEY);

    } catch (err) {
        console.error(err);
        toast.error('שגיאה בשליחת המייל: ' + (err.response?.data?.message || err.message), { id: toastId });
    } finally {
        setIsSending(false);
    }
  };

  const handleSave = async (showToast = true) => {
      const latestBlocks = getLatestBlocks();
      setIsSavingToServer(true);
      try {
        if (actualGroupId && group) {
          // שמירה לקבוצה + עדכון billing profile וטעינת תשלום
          await updateGroup(group._id, {
            paymentRequest: {
              blocks: latestBlocks,
              orderNumber, 
              headerDetails, 
              totalAmount,
              currency,
              lastUpdated: new Date() 
            }
          });
          
          // עדכון Billing Profile אם יש סכום כולל
          if (totalAmount > 0) {
            await api.put(`/payments/groups/${actualGroupId}/billing`, {
              totalExpected: totalAmount,
              currency: currency
            });
            
            // יצירת Payment record (charge) אם עדיין לא קיים במצב זה
            await api.post(`/payments/groups/${actualGroupId}/payments`, {
              type: 'invoice',
              amount: totalAmount,
              currency: currency,
              paymentDate: new Date(),
              description: `דרישת תשלום - ${headerDetails.groupName}`,
              status: 'pending',
              referenceNumber: `PR-${actualGroupId.substring(0, 8)}-${Date.now()}`
            });
          }
          
          if(showToast) toast.success("נשמר בשרת ותשלום נוצר בקבוצה");
        } else if (paymentRequestId) {
          // עדכון דרישת תשלום קיימת
          const htmlBody = containerRef.current?.innerHTML || '';
          await api.patch(`/payment-requests/${paymentRequestId}`, {
            content: latestBlocks,
            htmlBody,
            name: headerDetails.groupName,
            clientName: headerDetails.contactName,
            totalAmount: totalAmount,
            currency: currency,
            contactPerson: {
              name: headerDetails.contactName,
              phone: headerDetails.contactPhone,
              email: headerDetails.contactEmail
            }
          });
          if(showToast) toast.success("נשמר בשרת");
        } else {
          // שמירת דרישת תשלום חדשה
          const htmlBody = containerRef.current?.innerHTML || '';
          const response = await api.post('/payment-requests', {
            content: latestBlocks,
            htmlBody,
            name: headerDetails.groupName || `דרישה - ${new Date().toLocaleDateString('he-IL')}`,
            clientName: headerDetails.contactName,
            totalAmount: totalAmount,
            currency: currency,
            contactPerson: {
              name: headerDetails.contactName,
              phone: headerDetails.contactPhone,
              email: headerDetails.contactEmail
            }
          });
          if(showToast) toast.success("נשמר בשרת");
          if (onSave) onSave(response.data.data?.paymentRequest);
        }
        localStorage.removeItem(DRAFT_KEY);
      } catch (err) {
        if(showToast) toast.error('שגיאה בשמירה: ' + (err.response?.data?.message || err.message));
        console.error(err);
      } finally {
        setIsSavingToServer(false);
      }
  };

  if (actualGroupId && !group) return <div className="flex justify-center pt-20">טוען נתונים...</div>;

  return (
    <div className="min-h-screen bg-slate-100 py-10 font-sans text-slate-800">
      <style>{printStyles}</style>

      {contextMenu && (
          <RichTextMenu 
            position={contextMenu} 
            onClose={() => setContextMenu(null)} 
            onAction={executeAction}
            type={contextMenu.type}
          />
      )}

      {/* --- סרגל כלים עליון --- */}
      <div className="fixed top-0 left-0 w-full bg-white z-50 shadow-sm border-b h-16 flex items-center justify-between px-8 no-print">
         <div className="font-bold text-gray-700 text-lg flex items-center gap-2">
             <FileDown className="text-amber-500"/> מחולל דרישת תשלום
             <span className="text-xs font-normal text-gray-400 mr-2 bg-gray-100 px-2 py-0.5 rounded-full">נשמר בטיוטה אוטומטית</span>
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

         <div className="flex gap-3">
             <button onClick={() => handleSave(true)} className="flex items-center gap-2 bg-slate-100 text-slate-700 border px-4 py-2 rounded hover:bg-slate-200 font-bold text-sm"><Save size={16}/> שמור בשרת</button>
             <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 font-bold text-sm shadow-sm">
                 {isDownloading ? <LoaderCircle className="animate-spin" size={16}/> : <FileDown size={16}/>} הורד PDF
             </button>
             <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 font-bold text-sm shadow-sm"><Printer size={16}/> הדפס</button>
         </div>
      </div>

      <div className="flex flex-col items-center gap-8 mt-10" ref={containerRef}>
        {paginatedPages.map((pageBlocks, pageIndex) => (
            <div key={pageIndex} className="quote-page bg-white w-[210mm] h-[297mm] relative shadow-2xl p-[15mm] flex flex-col mx-auto">
                {pageIndex === 0 ? (
                    <header className="border-b-[3px] pb-4 mb-6" style={{ borderColor: GOLD }}>
                        <div className="flex justify-between items-start">
                            <div className="text-right pt-2 w-[55%]">
                                <div className="text-sm font-serif mb-2 text-gray-500">בס"ד</div>
                                <div className="flex items-center gap-1 mb-2">
                                    <span className="text-2xl font-bold text-slate-900 ml-1">לכבוד:</span>
                                    <input 
                                        type="text"
                                        value={headerDetails.groupName}
                                        onChange={(e) => setHeaderDetails({ ...headerDetails, groupName: e.target.value })}
                                        className="text-2xl font-bold text-slate-900 bg-transparent outline-none w-full placeholder:text-gray-300"
                                        placeholder="שם הלקוח/קבוצה"
                                    />
                                </div>
                                
                                <div className="text-slate-700 text-base space-y-1 mb-4 flex flex-col">
                                    <input 
                                        type="text"
                                        value={headerDetails.contactName}
                                        onChange={(e) => setHeaderDetails({ ...headerDetails, contactName: e.target.value })}
                                        className="font-medium bg-transparent outline-none w-full placeholder:text-gray-300"
                                        placeholder="שם איש קשר"
                                    />
                                    <input 
                                        type="text"
                                        value={headerDetails.contactPhone}
                                        onChange={(e) => setHeaderDetails({ ...headerDetails, contactPhone: e.target.value })}
                                        className="bg-transparent outline-none w-full placeholder:text-gray-300"
                                        placeholder="טלפון"
                                    />
                                    <input 
                                        type="text"
                                        value={headerDetails.contactEmail}
                                        onChange={(e) => setHeaderDetails({ ...headerDetails, contactEmail: e.target.value })}
                                        className="bg-transparent outline-none w-full placeholder:text-gray-300"
                                        placeholder="מייל"
                                    />
                                </div>
                            </div>
                            <div className="text-left w-[45%] flex flex-col items-end">
                                <img src="/pop.png" alt="Logo" className="h-32 object-contain mb-3" />
                            </div>
                        </div>
                        <div className="text-center mt-4">
                            <h1 className="text-5xl font-bold mb-4 inline-block pb-1" style={{ color: GOLD, borderColor: GOLD }}>דרישת תשלום</h1>
                            <div className="text-lg font-medium flex justify-center items-center gap-2">
                                 <span>מספר הזמנה:</span>
                                 <input 
                                    type="text" 
                                    value={orderNumber} 
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    placeholder="הזן..."
                                    className="border-b border-gray-300 focus:border-amber-500 outline-none w-32 text-center bg-transparent relative z-20"
                                 />
                            </div>
                        </div>
                    </header>
                ) : (
                    <div className="border-b mb-6 pb-2 flex justify-between text-gray-400 text-xs uppercase tracking-wider">
                        <span>המשך דרישת תשלום: {headerDetails.groupName}</span>
                        <span>עמוד {pageIndex + 1}</span>
                    </div>
                )}

                <div className="flex-grow flex flex-col">
                    {pageIndex === 0 && pageBlocks.length === 0 && (
                        <div className="flex justify-center p-4"><Inserter onAddText={() => addBlock(-1, 'text')} onAddTable={() => addBlock(-1, 'table')} /></div>
                    )}

                    {pageBlocks.map((block) => {
                        const realIndex = blocks.findIndex(b => b.id === block.id);
                        return (
                            <div key={block.id} ref={el => blockRefs.current[block.id] = el} className="relative group/block mb-1"> 
                                <button onClick={() => removeBlock(block.id)} className="absolute -right-10 top-0 text-gray-300 hover:text-red-500 no-print opacity-0 group-hover/block:opacity-100 transition-opacity p-2 z-30"><Trash2 size={16}/></button>

                                {block.type === 'text' ? (
                                    <div
                                        contentEditable
                                        onContextMenu={(e) => handleContextMenu(e, 'text', block.id)}
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
                                        onBlur={(e) => updateBlock(block.id, { content: e.target.innerHTML })}
                                        className="w-full min-h-[1.5em] outline-none border border-transparent hover:border-blue-200 focus:border-blue-400 p-2 rounded transition-colors text-sm leading-relaxed whitespace-pre-wrap relative z-20"
                                    />
                                ) : (
                                    <div className="w-full border border-transparent hover:border-amber-200 rounded p-1 transition-colors relative group/table z-10">
                                        <div className="no-print absolute -top-6 left-0 text-[10px] text-gray-400 bg-white border px-2 rounded opacity-0 group-hover/table:opacity-100 transition-opacity flex items-center gap-1 z-50">
                                            <MousePointerClick size={10}/> קליק ימני לתפריט אפשרויות
                                        </div>

                                        <input
                                            value={block.title || ''}
                                            onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                            className="font-bold text-slate-700 text-base bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 outline-none px-1 w-full mb-1"
                                            placeholder="כותרת טבלה..."
                                        />

                                        <table className="w-full border-collapse table-fixed relative z-10">
                                            <thead>
                                                <tr className="bg-white text-slate-700 border-b border-t border-slate-300" style={{ borderTopColor: GOLD, borderTopWidth: '2px' }}>
                                                    {block.headers.map((h, idx) => (
                                                        <th key={idx} className="border-l border-slate-200 p-2 align-bottom relative group/th bg-gray-50" style={{ width: `${h.width}%` }} onContextMenu={(e) => handleContextMenu(e, 'table', block.id, -1, idx)}>
                                                            <div contentEditable suppressContentEditableWarning onBlur={(e) => tableActions.updateHeaderTitle(block.id, idx, e.target.innerText)} className="w-full bg-transparent text-center font-bold text-sm outline-none whitespace-normal break-words min-h-[1.5em] relative z-50" dangerouslySetInnerHTML={{ __html: sanitizeHtml(h.title) }} />
                                                            <div className="flex items-center justify-center gap-1 no-print opacity-0 group-hover/th:opacity-100 transition-opacity bg-white absolute bottom-full left-0 w-full z-[60] shadow border p-1 rounded mb-1">
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
                                                            <td key={cIdx} className="border-l border-slate-200 p-2 align-top relative" onContextMenu={(e) => handleContextMenu(e, 'table', block.id, rIdx, cIdx)}>
                                                                <div contentEditable suppressContentEditableWarning onBlur={(e) => tableActions.updateCell(block.id, rIdx, cIdx, e.target.innerText)} className="w-full min-h-[1.5em] outline-none whitespace-pre-wrap text-sm relative z-50 cursor-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(cell) }} />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                
                                <div className="w-full flex justify-center h-0 overflow-visible relative z-50 no-print">
                                    <div className="absolute top-[-14px]"> 
                                        <Inserter onAddText={() => addBlock(realIndex, 'text')} onAddTable={() => addBlock(realIndex, 'table')} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Edit mode: סך הכל input section (no-print) */}
                {pageIndex === paginatedPages.length - 1 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded no-print flex items-center gap-3 border border-blue-200">
                        <label className="text-sm font-medium text-gray-700">סך הכל לתשלום:</label>
                        <input
                            type="number"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="סכום"
                            className="flex-1 max-w-xs font-semibold text-gray-800 border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm"
                        />
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded bg-white text-sm font-medium"
                        >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                            <option value="EUR">€</option>
                        </select>
                    </div>
                )}
                {/* Printable: סך הכל summary - simple line */}
                {pageIndex === paginatedPages.length - 1 && totalAmount > 0 && (
                    <div className="mt-6 pt-3 border-t border-gray-300 px-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700">סה"כ סכום לתשלום:</span>
                            <span className="text-base font-bold text-gray-900">
                                {totalAmount.toLocaleString('he-IL')} {currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : '€'}
                            </span>
                        </div>
                    </div>
                )}
                {pageIndex === paginatedPages.length - 1 && (
                    <div className="mt-auto pt-10 px-4 flex justify-between items-end pb-8 text-slate-800">
                       <div className="text-right text-sm leading-relaxed">
                           <div className="font-bold text-base" style={{ color: GOLD, borderColor: GOLD }}>בברכה,</div>
                           <div className="font-bold text-base">שטערני דהאן</div>
                           <div className="font-bold text-slate-800 mt-1">0548471446</div>
                           <div className="text-slate-600">ציפורי אירוח ואירועים בע"מ</div>
                       </div>
                    </div>
                )}
            </div> 
        ))}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default PaymentRequestGenerator;