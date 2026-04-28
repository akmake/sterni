import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, Trash2, Table as TableIcon, Type, FileDown, LoaderCircle, Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, List, ListOrdered, MousePointerClick, Send, Mail, User, Phone, Users, FileText, Eye, X, PanelRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { getQuoteTemplates } from '@/services/settingsService';
import { getDefaultQuoteTemplate, cloneQuoteTemplate } from '@/constants/quoteTemplateDefaults';
import QuoteManager from './QuoteManager';
import QuoteDatePicker from './QuoteDatePicker';

// --- הגדרות A4 ---
const A4_HEIGHT_PX = 1123;
const PAGE_MARGIN_Y = 140;
const CONTENT_HEIGHT = A4_HEIGHT_PX - PAGE_MARGIN_Y;
const GOLD = '#C5A059';
const FIRST_PAGE_BASE_HEIGHT = 360;
const OTHER_PAGE_BASE_HEIGHT = 170;
const SIGNATURE_RESERVED_HEIGHT = 220;
const BLOCK_VERTICAL_GAP = 30;
const FALLBACK_BLOCK_HEIGHT = 120;
const PAGE_OVERFLOW_TOLERANCE = 2;
const MOBILE_BREAKPOINT = 1024;

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

const PriceQuoteGeneratorPdf = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const getIsMobileViewport = () =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const blockRefs = useRef({});
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = getIsMobileViewport();
      setIsMobileViewport(nextIsMobile);
      if (!nextIsMobile) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileViewport, isSidebarOpen]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        window.URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setRawArrivalDate(todayStr);
    setRawDepartureDate(todayStr);
    setArrivalDate(formatEventDateDayHebrew(todayStr));
    setDepartureDate(formatEventDateDayHebrew(todayStr));

    const defaultTemplate = getDefaultQuoteTemplate();
    setQuoteTitle(defaultTemplate.quoteTitle);
    setEventType(defaultTemplate.eventType);
    setMinPaxPrefix(defaultTemplate.minPaxPrefix);
    setMinPaxSuffix(defaultTemplate.minPaxSuffix);
    setBlocks(cloneQuoteTemplate(defaultTemplate.blocks));
  }, []);

  useEffect(() => {
    if (location.state?.loadQuote) return;
    fetchAndApplySavedTemplate({ silent: true });
  }, [location.state?.loadQuote]);

  const getBlockMeasuredHeight = (block) => {
    const element = blockRefs.current[block.id];
    if (!element) return FALLBACK_BLOCK_HEIGHT;
    return Math.ceil(element.getBoundingClientRect().height) + BLOCK_VERTICAL_GAP;
  };

  const buildPaginatedPages = (sourceBlocks = [], firstBase = FIRST_PAGE_BASE_HEIGHT, otherBase = OTHER_PAGE_BASE_HEIGHT) => {
    if (!sourceBlocks.length) return [[]];

    const pages = [];
    let currentPage = [];
    let currentHeight = firstBase;

    sourceBlocks.forEach((block) => {
      const blockHeight = getBlockMeasuredHeight(block);
      const canFit = currentHeight + blockHeight <= CONTENT_HEIGHT;

      if (!canFit && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [block];
        currentHeight = otherBase + blockHeight;
      } else {
        currentPage.push(block);
        currentHeight += blockHeight;
      }
    });

    if (currentPage.length > 0) pages.push(currentPage);

    const lastPageBase = pages.length === 1 ? firstBase : otherBase;
    const lastPageBlocksHeight = (pages[pages.length - 1] || []).reduce(
      (sum, block) => sum + getBlockMeasuredHeight(block),
      0
    );

    if (lastPageBase + lastPageBlocksHeight + SIGNATURE_RESERVED_HEIGHT > A4_HEIGHT_PX) {
      pages.push([]);
    }

    return pages;
  };

  useLayoutEffect(() => {
    if (!blocks.length) return;
    const nextPages = buildPaginatedPages(blocks);
    const nextIds = JSON.stringify(nextPages.map((p) => p.map((b) => b.id)));
    const currentIds = JSON.stringify(paginatedPages.map((p) => p.map((b) => b.id)));
    if (nextIds !== currentIds) {
      setPaginatedPages(nextPages);
    }
  }, [blocks, paginatedPages]);

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

  const applyTemplateToEditor = (template) => {
    if (!template || typeof template !== 'object') return;

    if (typeof template.quoteTitle === 'string' && template.quoteTitle.trim()) {
      setQuoteTitle(template.quoteTitle);
    }
    if (typeof template.eventType === 'string' && template.eventType.trim()) {
      setEventType(template.eventType);
    }
    if (typeof template.minPaxPrefix === 'string' && template.minPaxPrefix.trim()) {
      setMinPaxPrefix(template.minPaxPrefix);
    }
    if (typeof template.minPaxSuffix === 'string' && template.minPaxSuffix.trim()) {
      setMinPaxSuffix(template.minPaxSuffix);
    }
    if (Array.isArray(template.blocks) && template.blocks.length > 0) {
      setBlocks(cloneQuoteTemplate(template.blocks));
    }
  };

  const fetchAndApplySavedTemplate = async ({ silent = false, preferredTemplateId = '' } = {}) => {
    setIsTemplateLoading(true);
    try {
      const response = await getQuoteTemplates();
      const templates = Array.isArray(response?.templates) ? response.templates : [];
      const nextActiveTemplateId = response?.activeTemplateId || '';
      setTemplateOptions(templates);
      setActiveTemplateId(nextActiveTemplateId);

      if (!templates.length) {
        if (!silent) toast('לא נמצאו תבניות שמורות.');
        return false;
      }

      const targetTemplateId =
        (preferredTemplateId && templates.some((template) => template.templateId === preferredTemplateId) && preferredTemplateId) ||
        (selectedTemplateId && templates.some((template) => template.templateId === selectedTemplateId) && selectedTemplateId) ||
        (nextActiveTemplateId && templates.some((template) => template.templateId === nextActiveTemplateId) && nextActiveTemplateId) ||
        templates[0].templateId;

      const selectedTemplate = templates.find((template) => template.templateId === targetTemplateId) || templates[0];
      setSelectedTemplateId(selectedTemplate.templateId);
      applyTemplateToEditor(selectedTemplate);
      if (!silent) toast.success(`נטענה תבנית: ${selectedTemplate.name || 'ללא שם'}`);
      return true;
    } catch (error) {
      console.error('Failed to load saved quote templates:', error);
      if (!silent) toast.error('שגיאה בטעינת התבניות.');
      return false;
    } finally {
      setIsTemplateLoading(false);
    }
  };

  const handleTemplateSelection = (templateId) => {
    if (!templateId) return;
    const selectedTemplate = templateOptions.find((template) => template.templateId === templateId);
    if (!selectedTemplate) return;

    setSelectedTemplateId(templateId);
    applyTemplateToEditor(selectedTemplate);
    if (isMobileViewport) {
      setIsSidebarOpen(false);
    }
    toast.success(`נבחרה תבנית: ${selectedTemplate.name || 'ללא שם'}`);
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
    minPaxPrefix,
    minPaxSuffix,
    selectedTemplateId,
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
    if (data.minPaxPrefix) setMinPaxPrefix(data.minPaxPrefix);
    if (data.minPaxSuffix) setMinPaxSuffix(data.minPaxSuffix);

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

    if (data.minPax !== undefined && data.minPax !== null) setMinPax(String(data.minPax));
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

  const safePdfName = (name) =>
    String(name || 'quote')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120) || 'quote';

  const copyComputedStyle = (sourceEl, targetEl) => {
    if (!(sourceEl instanceof Element) || !(targetEl instanceof Element)) return;
    const computed = window.getComputedStyle(sourceEl);
    const cssText = Array.from(computed)
      .map((prop) => `${prop}:${computed.getPropertyValue(prop)};`)
      .join('');
    targetEl.setAttribute('style', cssText);
  };

  const replaceFormElement = (sourceEl, targetEl) => {
    if (!(sourceEl instanceof HTMLElement) || !(targetEl instanceof HTMLElement)) return;

    if (sourceEl instanceof HTMLInputElement || sourceEl instanceof HTMLTextAreaElement) {
      const span = document.createElement('span');
      copyComputedStyle(sourceEl, span);
      span.textContent = sourceEl.value || '';
      targetEl.replaceWith(span);
      return;
    }

    if (sourceEl instanceof HTMLSelectElement) {
      const span = document.createElement('span');
      copyComputedStyle(sourceEl, span);
      span.textContent = sourceEl.options[sourceEl.selectedIndex]?.text || '';
      targetEl.replaceWith(span);
    }
  };

  const waitForNextPaint = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

  const getOverflowingPageIndexes = () => {
    if (!containerRef.current) return [];
    const pageElements = Array.from(containerRef.current.querySelectorAll('.quote-page'));
    const overflowing = [];

    pageElements.forEach((page, index) => {
      if (page.scrollHeight - page.clientHeight > PAGE_OVERFLOW_TOLERANCE) {
        overflowing.push(index);
      }
    });

    return overflowing;
  };

  const stabilizeLayoutBeforePdf = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const latestBlocks = getLatestBlocks();
    setBlocks(latestBlocks);
    await waitForNextPaint();

    let extraBase = 0;
    let attempts = 0;
    while (attempts < 5) {
      const nextPages = buildPaginatedPages(
        latestBlocks,
        FIRST_PAGE_BASE_HEIGHT + extraBase,
        OTHER_PAGE_BASE_HEIGHT + extraBase
      );
      setPaginatedPages(nextPages);
      await waitForNextPaint();

      const overflowingPages = getOverflowingPageIndexes();
      if (overflowingPages.length === 0) return;

      extraBase += 16;
      attempts += 1;
    }

    throw new Error('לא ניתן לייצב את העימוד ל-A4 ללא חריגה. יש לצמצם תוכן בעמוד.');
  };

  const resolveImageSrcForPdf = (imageEl) => {
    if (!(imageEl instanceof HTMLImageElement)) return '';
    const absoluteSrc = imageEl.currentSrc || imageEl.src || '';
    if (!absoluteSrc) return '';
    if (absoluteSrc.startsWith('data:')) return absoluteSrc;

    if (imageEl.complete && imageEl.naturalWidth > 0 && imageEl.naturalHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageEl.naturalWidth;
        canvas.height = imageEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageEl, 0, 0);
          return canvas.toDataURL('image/png');
        }
      } catch {
        // If canvas gets tainted or fails, fallback to absolute URL.
      }
    }

    return absoluteSrc;
  };

  const polishClonedPageForPdf = (pageEl, pageIndex) => {
    if (!(pageEl instanceof HTMLElement)) return;

    pageEl.style.fontFamily = '"Assistant", "Rubik", "Segoe UI", Arial, sans-serif';
    pageEl.style.color = '#0f172a';
    pageEl.style.webkitFontSmoothing = 'antialiased';
    pageEl.style.textRendering = 'geometricPrecision';

    const heading = pageEl.querySelector('header');
    if (heading instanceof HTMLElement) {
      heading.style.borderBottomColor = GOLD;
      heading.style.borderBottomWidth = '2px';
      heading.style.paddingBottom = '16px';
      heading.style.marginBottom = '18px';
    }

    if (pageIndex > 0) {
      const continuationBar = pageEl.querySelector(':scope > div');
      if (continuationBar instanceof HTMLElement) {
        continuationBar.style.borderBottomColor = '#e6d4ad';
        continuationBar.style.color = '#64748b';
        continuationBar.style.fontWeight = '600';
      }
    }

    pageEl.querySelectorAll('table').forEach((table) => {
      if (!(table instanceof HTMLElement)) return;
      table.style.border = '1px solid #dbe3ee';
      table.style.borderCollapse = 'collapse';
      table.style.tableLayout = 'fixed';
    });

    pageEl.querySelectorAll('thead th').forEach((th) => {
      if (!(th instanceof HTMLElement)) return;
      th.style.background = '#f8fafc';
      th.style.color = '#334155';
      th.style.fontWeight = '700';
    });

    pageEl.querySelectorAll('tbody tr:nth-child(even) td').forEach((td) => {
      if (!(td instanceof HTMLElement)) return;
      td.style.background = '#fcfdff';
    });

    pageEl.querySelectorAll('img').forEach((img) => {
      if (!(img instanceof HTMLElement)) return;
      img.style.imageRendering = '-webkit-optimize-contrast';
    });
  };

  const captureStyledHtmlForPdf = () => {
    if (!containerRef.current) return '';
    const sourcePages = Array.from(containerRef.current.querySelectorAll('.quote-page'));
    if (!sourcePages.length) return '';

    const htmlChunks = sourcePages.map((sourcePage, pageIndex) => {
      const clonedPage = sourcePage.cloneNode(true);
      const sourceElements = [sourcePage, ...sourcePage.querySelectorAll('*')];
      const clonedElements = [clonedPage, ...clonedPage.querySelectorAll('*')];

      sourceElements.forEach((sourceEl, idx) => {
        const clonedEl = clonedElements[idx];
        if (!clonedEl) return;
        copyComputedStyle(sourceEl, clonedEl);
        clonedEl.removeAttribute('contenteditable');

        if (sourceEl instanceof HTMLImageElement && clonedEl instanceof HTMLImageElement) {
          const resolvedSrc = resolveImageSrcForPdf(sourceEl);
          if (resolvedSrc) {
            clonedEl.setAttribute('src', resolvedSrc);
            clonedEl.removeAttribute('srcset');
            clonedEl.removeAttribute('sizes');
            clonedEl.setAttribute('loading', 'eager');
            clonedEl.setAttribute('decoding', 'sync');
          }
        }
      });

      sourceElements.forEach((sourceEl, idx) => {
        const clonedEl = clonedElements[idx];
        if (!clonedEl) return;
        replaceFormElement(sourceEl, clonedEl);
      });

      clonedPage.querySelectorAll('.no-print, .inserter-line, button').forEach((el) => el.remove());
      clonedPage.querySelectorAll('th, td').forEach((cell) => {
        cell.style.wordBreak = 'break-word';
        cell.style.overflowWrap = 'anywhere';
      });
      clonedPage.style.width = '210mm';
      clonedPage.style.height = '297mm';
      clonedPage.style.margin = '0';
      clonedPage.style.boxShadow = 'none';
      clonedPage.style.overflow = 'hidden';
      clonedPage.style.position = 'relative';
      clonedPage.style.pageBreakAfter = 'always';
      clonedPage.style.breakAfter = 'page';
      polishClonedPageForPdf(clonedPage, pageIndex);
      return clonedPage.outerHTML;
    });

    return htmlChunks.join('');
  };

  const renderPdfBlob = async () => {
    await stabilizeLayoutBeforePdf();
    const html = captureStyledHtmlForPdf();
    if (!html) {
      throw new Error('לא נמצא תוכן להפקת PDF');
    }

    const response = await api.post(
      '/quotes-pdf/render',
      {
        html,
        fileName: `quote_${safePdfName(clientName)}`,
      },
      {
        responseType: 'blob',
      }
    );

    if (response.data instanceof Blob) return response.data;
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading('מייצר PDF להורדה...');

    try {
        const pdfBlob = await renderPdfBlob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quote_${safePdfName(clientName)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success('הקובץ נוצר!', { id: toastId });
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
        const pdfBlob = await renderPdfBlob();

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

  const closePreview = () => {
    setIsPreviewOpen(false);
    if (previewPdfUrl) {
      window.URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl('');
    }
  };

  const handlePreviewPDF = async () => {
    if (isPreviewLoading) return;
    setIsPreviewLoading(true);
    const toastId = toast.loading('מייצר תצוגה מקדימה...');

    try {
      const pdfBlob = await renderPdfBlob();
      if (previewPdfUrl) {
        window.URL.revokeObjectURL(previewPdfUrl);
      }
      const objectUrl = window.URL.createObjectURL(pdfBlob);
      setPreviewPdfUrl(objectUrl);
      setIsPreviewOpen(true);
      toast.success('התצוגה מוכנה', { id: toastId });
    } catch (err) {
      console.error('Preview PDF Error:', err);
      toast.error('שגיאה ביצירת תצוגה מקדימה', { id: toastId });
    } finally {
      setIsPreviewLoading(false);
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

      <div className="shrink-0 bg-white z-50 shadow-sm border-b no-print px-3 sm:px-5 lg:px-8 py-3">
         <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
         <div className="font-bold text-gray-700 text-base sm:text-lg flex items-center gap-2">
            <FileDown className="text-amber-500"/> Quote Generator (PDF Live)
         </div>

         <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-md border border-blue-100 w-full xl:w-auto">
            <Mail size={16} className="text-blue-500 shrink-0"/>
            <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="מייל לשליחה..."
                className="bg-transparent text-sm outline-none w-full xl:w-48 text-blue-900 placeholder:text-blue-300"
            />
            <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 shrink-0"
            >
                {isSending ? <LoaderCircle className="animate-spin" size={14}/> : <Send size={14}/>}
                שלח
            </button>
         </div>

         <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
             {/* ★ שינוי: containerRef מועבר ל-QuoteManager */}
             <QuoteManager
                currentData={dataToSave}
                onLoadData={handleLoadData}
                containerRef={containerRef}
                getLatestBlocks={getLatestBlocks}
             />

             <button
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden flex items-center gap-1.5 bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded font-bold text-xs shadow-sm"
             >
               <PanelRight size={15} />
               פרטים
             </button>

             <div className="hidden sm:block h-6 w-[1px] bg-gray-300 mx-1"></div>

             <button
               onClick={() => navigate('/price-quote-template')}
               className="flex items-center gap-2 bg-white border border-indigo-300 text-indigo-700 px-3 sm:px-4 py-2 rounded hover:bg-indigo-50 font-bold text-xs sm:text-sm shadow-sm"
             >
               עריכת תבנית
             </button>

             <button
               onClick={handlePreviewPDF}
               disabled={isPreviewLoading}
               className="flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-indigo-700 font-bold text-xs sm:text-sm shadow-sm disabled:opacity-50"
             >
               {isPreviewLoading ? <LoaderCircle className="animate-spin" size={16}/> : <Eye size={16}/>} תצוגת PDF
             </button>

             <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 bg-amber-500 text-white px-3 sm:px-4 py-2 rounded hover:bg-amber-600 font-bold text-xs sm:text-sm shadow-sm">
                 {isDownloading ? <LoaderCircle className="animate-spin" size={16}/> : <FileDown size={16}/>} הורד PDF
             </button>
             <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-white px-3 sm:px-4 py-2 rounded hover:bg-slate-900 font-bold text-xs sm:text-sm shadow-sm"><Printer size={16}/> הדפס</button>
         </div>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative flex-col lg:flex-row">
        {isMobileViewport && isSidebarOpen && (
          <button
            type="button"
            aria-label="סגור חלון פרטים"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-[210] lg:hidden no-print"
          />
        )}

        <div className={`${
          isMobileViewport
            ? `fixed top-0 right-0 bottom-0 w-[88vw] max-w-[360px] bg-white border-l border-gray-200 shadow-2xl z-[220] transform transition-transform duration-300 ${
                isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
              }`
            : 'w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-l border-gray-200 shadow-xl'
        } overflow-y-auto shrink-0 flex flex-col no-print max-h-screen lg:max-h-none`}>
            <div className="p-4 sm:p-5 space-y-5 sm:space-y-6">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <User size={20} className="text-blue-600"/>
                      פרטי ההזמנה
                    </span>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
                      aria-label="סגור פרטי הזמנה"
                    >
                      <X size={16} />
                    </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

                    <div className="pt-3 border-t">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                            <div className="text-sm font-bold text-blue-900">תבניות הצעת מחיר</div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-blue-800">בחר תבנית להצעה הנוכחית</label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={(e) => handleTemplateSelection(e.target.value)}
                                    className="w-full text-sm border border-blue-300 rounded px-2 py-1.5 bg-white text-blue-900"
                                >
                                    <option value="">בחר תבנית...</option>
                                    {templateOptions.map((template) => (
                                      <option key={template.templateId} value={template.templateId}>
                                        {template.name}{template.templateId === activeTemplateId ? ' (ברירת מחדל)' : ''}
                                      </option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                אפשר ליצור כמה תבניות, לתת שם לכל תבנית, ולבחור כאן מה להחיל על ההצעה הזאת.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={() => fetchAndApplySavedTemplate({ preferredTemplateId: selectedTemplateId })}
                                    disabled={isTemplateLoading}
                                    className="flex-1 bg-white text-blue-700 text-xs px-3 py-2 rounded border border-blue-300 hover:bg-blue-100 disabled:opacity-50 font-bold"
                                >
                                    {isTemplateLoading ? 'טוען...' : 'רענן תבניות'}
                                </button>
                                <button
                                    onClick={() => navigate('/price-quote-template')}
                                    className="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 font-bold"
                                >
                                    עבור לעורך התבנית
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 sm:mt-8 bg-amber-50 p-3 rounded text-xs text-amber-800 border border-amber-200">
                    <p><strong>שים לב:</strong> הנתונים שמוזנים כאן נכנסים אוטומטית לתוך המסמך משמאל ונשמרים במערכת בעת שמירת ההצעה.</p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-6 lg:p-10 flex justify-start lg:justify-center bg-slate-100 min-h-[52vh] lg:min-h-0" ref={containerRef}>

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

                                    <div className="text-slate-700 text-base space-y-0.5 mb-2">
                                        <TransparentInput value={contactName} onChange={setContactName} className="font-medium" placeholder="שם איש קשר" />
                                        <TransparentInput value={contactPhone} onChange={setContactPhone} placeholder="טלפון" />
                                        <TransparentInput value={contactEmail} onChange={setContactEmail} placeholder="מייל" />
                                    </div>

                                    <div className="mt-1 text-sm space-y-0.5">
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
                                        className="w-12 text-lg font-bold text-center bg-transparent border-none outline-none p-0"
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
                        <div className="border-b mb-6 pb-2 flex items-center gap-3 text-gray-400 text-xs uppercase tracking-wider">
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap">המשך הצעה: {clientName}</span>
                            <span className="shrink-0 whitespace-nowrap">עמוד {pageIndex + 1} / {paginatedPages.length}</span>
                        </div>
                    )}

                    <div className={`flex-grow flex flex-col ${pageIndex === paginatedPages.length - 1 ? 'pb-48' : ''}`}>
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
                        <div className="absolute left-[15mm] right-[15mm] bottom-[8mm] flex justify-between items-end text-slate-800">
                            <div className="text-right text-sm leading-relaxed">
                                <div className="font-bold text-base" style={{ color: GOLD, borderColor: GOLD }}>בברכה,</div>
                                <div className="font-bold text-base">שטערני דהאן</div>
                                <div className="text-slate-600">08-8593775</div>
                                <div className="font-bold text-slate-800 mt-1">ציפורי אירוח ואירועים בע"מ</div>
                            </div>

                            <div className="text-center translate-y-4">
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

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 no-print" dir="rtl">
          <div className="bg-white w-[95vw] h-[92vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="h-14 shrink-0 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Eye size={18} className="text-indigo-600" />
                תצוגה מקדימה של PDF
              </div>
              <button onClick={closePreview} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            <div className="flex-1 bg-slate-200">
              {previewPdfUrl ? (
                <iframe title="PDF Preview" src={previewPdfUrl} className="w-full h-full border-0" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">טוען תצוגה...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceQuoteGeneratorPdf;






