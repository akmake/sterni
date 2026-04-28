import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  RotateCcw,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  FileText,
  Copy,
  CheckCircle2,
  Type,
  Highlighter,
  ArrowBigUp,
  ArrowBigDown,
  Strikethrough,
  Table2,
  Columns3,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getQuoteTemplates,
  createQuoteTemplate,
  updateQuoteTemplateById,
  deleteQuoteTemplateById,
  activateQuoteTemplateById,
} from '@/services/settingsService';
import { getDefaultQuoteTemplate, cloneQuoteTemplate } from '@/constants/quoteTemplateDefaults';

const DEFAULT_NEW_TEMPLATE_NAME = 'תבנית חדשה';
const DEFAULT_FONT = 'inherit';

const FONT_OPTIONS = [
  { label: 'ברירת מחדל', value: DEFAULT_FONT },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'David', value: '"David", serif' },
  { label: 'Rubik', value: '"Rubik", sans-serif' },
  { label: 'Assistant', value: '"Assistant", sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
];

const createTextBlock = (content = 'כתוב כאן טקסט חדש...') => ({
  id: crypto.randomUUID(),
  type: 'text',
  content,
});

const createTableBlock = () => ({
  id: crypto.randomUUID(),
  type: 'table',
  title: 'טבלה חדשה',
  headers: [
    { title: 'עמודה 1', width: 34 },
    { title: 'עמודה 2', width: 33 },
    { title: 'עמודה 3', width: 33 },
  ],
  rows: [['', '', '']],
});

const rebalanceHeaderWidths = (headers) => {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  if (!safeHeaders.length) return [];
  const base = Math.floor(100 / safeHeaders.length);
  const remainder = 100 - base * safeHeaders.length;
  return safeHeaders.map((header, idx) => ({
    ...header,
    width: idx === 0 ? base + remainder : base,
  }));
};

const normalizeTableBlock = (block) => {
  const source = block && typeof block === 'object' ? block : {};
  const headers = Array.isArray(source.headers) && source.headers.length
    ? source.headers.map((header, idx) => ({
      title: typeof header?.title === 'string' ? header.title : `עמודה ${idx + 1}`,
      width: Number.isFinite(Number(header?.width)) ? Number(header.width) : 0,
    }))
    : createTableBlock().headers;

  const normalizedHeaders = rebalanceHeaderWidths(headers);
  const colCount = normalizedHeaders.length;
  const rowsSource = Array.isArray(source.rows) && source.rows.length ? source.rows : [new Array(colCount).fill('')];
  const rows = rowsSource.map((row) => {
    const next = new Array(colCount).fill('');
    if (Array.isArray(row)) {
      for (let i = 0; i < colCount; i += 1) next[i] = row[i] ?? '';
    }
    return next;
  });

  return {
    id: source.id || crypto.randomUUID(),
    type: 'table',
    title: typeof source.title === 'string' ? source.title : 'טבלה',
    headers: normalizedHeaders,
    rows,
  };
};

const normalizeBlocks = (blocks) => {
  if (!Array.isArray(blocks) || !blocks.length) return cloneQuoteTemplate(getDefaultQuoteTemplate().blocks);
  const normalized = blocks.map((block) => {
    if (block?.type === 'table') return normalizeTableBlock(block);
    return {
      id: block?.id || crypto.randomUUID(),
      type: 'text',
      content: typeof block?.content === 'string' ? block.content : '',
    };
  });
  return normalized.length ? normalized : [createTextBlock()];
};

const normalizeTemplateForEditor = (template) => {
  const fallback = getDefaultQuoteTemplate();
  const source = template && typeof template === 'object' ? template : fallback;

  return {
    templateId: source.templateId || '',
    name: (typeof source.name === 'string' && source.name.trim()) || DEFAULT_NEW_TEMPLATE_NAME,
    quoteTitle: typeof source.quoteTitle === 'string' && source.quoteTitle.trim() ? source.quoteTitle : fallback.quoteTitle,
    eventType: typeof source.eventType === 'string' && source.eventType.trim() ? source.eventType : fallback.eventType,
    minPaxPrefix: typeof source.minPaxPrefix === 'string' && source.minPaxPrefix.trim() ? source.minPaxPrefix : fallback.minPaxPrefix,
    minPaxSuffix: typeof source.minPaxSuffix === 'string' && source.minPaxSuffix.trim() ? source.minPaxSuffix : fallback.minPaxSuffix,
    blocks: normalizeBlocks(source.blocks),
  };
};

const QuoteTemplateEditorPage = () => {
  const navigate = useNavigate();
  const [activeEditable, setActiveEditable] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [textColor, setTextColor] = useState('#111827');
  const [highlightColor, setHighlightColor] = useState('#fff59d');

  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [templateName, setTemplateName] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [minPaxPrefix, setMinPaxPrefix] = useState('');
  const [minPaxSuffix, setMinPaxSuffix] = useState('');
  const [blocks, setBlocks] = useState([]);

  const [lastLoadedSignature, setLastLoadedSignature] = useState('');

  const currentTemplatePayload = useMemo(() => ({
    name: templateName.trim() || DEFAULT_NEW_TEMPLATE_NAME,
    quoteTitle,
    eventType,
    minPaxPrefix,
    minPaxSuffix,
    blocks: cloneQuoteTemplate(blocks),
  }), [templateName, quoteTitle, eventType, minPaxPrefix, minPaxSuffix, blocks]);

  const currentSignature = useMemo(
    () => JSON.stringify(currentTemplatePayload),
    [currentTemplatePayload]
  );
  const isDirty = currentSignature !== lastLoadedSignature;

  const applyTemplateToEditor = (template) => {
    const normalized = normalizeTemplateForEditor(template);
    setTemplateName(normalized.name);
    setQuoteTitle(normalized.quoteTitle);
    setEventType(normalized.eventType);
    setMinPaxPrefix(normalized.minPaxPrefix);
    setMinPaxSuffix(normalized.minPaxSuffix);
    setBlocks(normalized.blocks);
    setLastLoadedSignature(JSON.stringify({
      name: normalized.name,
      quoteTitle: normalized.quoteTitle,
      eventType: normalized.eventType,
      minPaxPrefix: normalized.minPaxPrefix,
      minPaxSuffix: normalized.minPaxSuffix,
      blocks: cloneQuoteTemplate(normalized.blocks),
    }));
  };

  const syncTemplatesState = (response, preferredTemplateId = '') => {
    const nextTemplates = Array.isArray(response?.templates) ? response.templates : [];
    const nextActiveTemplateId = response?.activeTemplateId || '';
    setTemplates(nextTemplates);
    setActiveTemplateId(nextActiveTemplateId);

    if (!nextTemplates.length) {
      const fallback = normalizeTemplateForEditor(null);
      setSelectedTemplateId('');
      applyTemplateToEditor(fallback);
      return;
    }

    const resolvedSelectedId =
      preferredTemplateId && nextTemplates.some((template) => template.templateId === preferredTemplateId)
        ? preferredTemplateId
        : selectedTemplateId && nextTemplates.some((template) => template.templateId === selectedTemplateId)
          ? selectedTemplateId
          : nextActiveTemplateId && nextTemplates.some((template) => template.templateId === nextActiveTemplateId)
            ? nextActiveTemplateId
            : nextTemplates[0].templateId;

    setSelectedTemplateId(resolvedSelectedId);
    const selectedTemplate = nextTemplates.find((template) => template.templateId === resolvedSelectedId) || nextTemplates[0];
    applyTemplateToEditor(selectedTemplate);
  };

  const loadTemplates = async ({ silent = false } = {}) => {
    setIsLoading(true);
    try {
      const response = await getQuoteTemplates();
      const hasTemplates = Array.isArray(response?.templates) && response.templates.length > 0;

      if (!hasTemplates) {
        const fallback = getDefaultQuoteTemplate();
        const created = await createQuoteTemplate({
          name: 'תבנית ראשית',
          quoteTitle: fallback.quoteTitle,
          eventType: fallback.eventType,
          minPaxPrefix: fallback.minPaxPrefix,
          minPaxSuffix: fallback.minPaxSuffix,
          blocks: fallback.blocks,
        });
        syncTemplatesState(created);
      } else {
        syncTemplatesState(response);
      }

      if (!silent) toast.success('התבניות נטענו בהצלחה');
    } catch (error) {
      console.error('Failed to load quote templates:', error);
      if (!silent) toast.error('שגיאה בטעינת התבניות');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates({ silent: true });
  }, []);

  const selectTemplate = (templateId) => {
    if (!templateId || templateId === selectedTemplateId) return;
    if (isDirty && !window.confirm('יש שינויים שלא נשמרו. לעבור תבנית בלי שמירה?')) return;

    const template = templates.find((item) => item.templateId === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    applyTemplateToEditor(template);
  };

  const updateBlock = (id, updates) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...updates } : block)));
  };

  const removeBlock = (id) => {
    setBlocks((prev) => {
      const next = prev.filter((block) => block.id !== id);
      return next.length ? next : [createTextBlock()];
    });
  };

  const duplicateBlock = (id) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      if (index < 0) return prev;
      const source = prev[index];
      const duplicated = cloneQuoteTemplate(source);
      duplicated.id = crypto.randomUUID();
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const insertBlockAt = (insertIndex, type) => {
    setBlocks((prev) => {
      const next = [...prev];
      const safeIndex = Math.max(0, Math.min(insertIndex, next.length));
      next.splice(safeIndex, 0, type === 'table' ? createTableBlock() : createTextBlock());
      return next;
    });
  };

  const moveBlock = (id, direction) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateTableCell = (blockId, rowIndex, colIndex, value) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        const rows = block.rows.map((row) => [...row]);
        rows[rowIndex][colIndex] = value;
        return { ...block, rows };
      })
    );
  };

  const updateTableHeader = (blockId, colIndex, value) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        const headers = block.headers.map((header, idx) => (idx === colIndex ? { ...header, title: value } : header));
        return { ...block, headers };
      })
    );
  };

  const addTableRow = (blockId) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        const newRow = new Array(block.headers.length).fill('');
        return { ...block, rows: [...block.rows, newRow] };
      })
    );
  };

  const removeTableRow = (blockId, rowIndex) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        const rows = block.rows.filter((_, idx) => idx !== rowIndex);
        return { ...block, rows: rows.length ? rows : [new Array(block.headers.length).fill('')] };
      })
    );
  };

  const addTableColumn = (blockId) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        const headers = rebalanceHeaderWidths([...block.headers, { title: `עמודה ${block.headers.length + 1}`, width: 0 }]);
        const rows = block.rows.map((row) => [...row, '']);
        return { ...block, headers, rows };
      })
    );
  };

  const removeTableColumn = (blockId, colIndex = null) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== 'table') return block;
        if (block.headers.length <= 1) return block;
        const indexToRemove = colIndex == null ? block.headers.length - 1 : colIndex;
        const headers = block.headers.filter((_, idx) => idx !== indexToRemove);
        const rows = block.rows.map((row) => row.filter((_, idx) => idx !== indexToRemove));
        return { ...block, headers: rebalanceHeaderWidths(headers), rows };
      })
    );
  };

  const ensureEditableFocus = () => {
    if (!activeEditable) {
      toast('לחץ בתוך אזור טקסט ואז בצע פעולה');
      return false;
    }
    activeEditable.focus();
    return true;
  };

  const runCommand = (command, value = null) => {
    if (!ensureEditableFocus()) return;
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(command, false, value);
  };

  const applyBlockFormat = (tagName) => {
    runCommand('formatBlock', tagName);
  };

  const applyFontFamily = (value) => {
    const fontValue = value === DEFAULT_FONT ? 'Arial' : value;
    setFontFamily(value);
    runCommand('fontName', fontValue);
  };

  const resetToDefault = () => {
    if (!window.confirm('לאפס את התוכן לערכי ברירת מחדל?')) return;
    const fallback = normalizeTemplateForEditor({
      ...getDefaultQuoteTemplate(),
      name: templateName || DEFAULT_NEW_TEMPLATE_NAME,
      templateId: selectedTemplateId,
    });
    applyTemplateToEditor(fallback);
    toast.success('התוכן אופס לברירת מחדל');
  };

  const createNewTemplate = async ({ duplicateCurrent = false } = {}) => {
    const suggestedName = duplicateCurrent
      ? `${templateName || 'תבנית'} - העתק`
      : `${DEFAULT_NEW_TEMPLATE_NAME} ${templates.length + 1}`;

    const name = window.prompt('שם לתבנית החדשה:', suggestedName);
    if (!name || !name.trim()) return;

    const payload = duplicateCurrent
      ? { ...currentTemplatePayload, name: name.trim() }
      : { ...normalizeTemplateForEditor({ ...getDefaultQuoteTemplate(), name: name.trim() }), name: name.trim() };

    try {
      const response = await createQuoteTemplate(payload);
      syncTemplatesState(response, response?.templates?.[response.templates.length - 1]?.templateId || '');
      toast.success('תבנית חדשה נוצרה');
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('שגיאה ביצירת תבנית');
    }
  };

  const saveTemplate = async () => {
    if (!selectedTemplateId || isSaving) return;
    setIsSaving(true);
    const toastId = toast.loading('שומר תבנית...');

    try {
      const response = await updateQuoteTemplateById(selectedTemplateId, currentTemplatePayload);
      syncTemplatesState(response, selectedTemplateId);
      toast.success('התבנית נשמרה בהצלחה', { id: toastId });
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('שגיאה בשמירת התבנית', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (templates.length <= 1) {
      toast.error('חייבת להישאר לפחות תבנית אחת');
      return;
    }
    if (!window.confirm('למחוק את התבנית הנוכחית?')) return;

    try {
      const response = await deleteQuoteTemplateById(selectedTemplateId);
      syncTemplatesState(response);
      toast.success('התבנית נמחקה');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('שגיאה במחיקת התבנית');
    }
  };

  const setAsDefaultTemplate = async () => {
    if (!selectedTemplateId || selectedTemplateId === activeTemplateId || isSettingDefault) return;
    setIsSettingDefault(true);
    const toastId = toast.loading('מעדכן תבנית ברירת מחדל...');

    try {
      if (isDirty) {
        await updateQuoteTemplateById(selectedTemplateId, currentTemplatePayload);
      }
      const response = await activateQuoteTemplateById(selectedTemplateId);
      syncTemplatesState(response, selectedTemplateId);
      toast.success('תבנית ברירת המחדל עודכנה', { id: toastId });
    } catch (error) {
      console.error('Failed to set default template:', error);
      toast.error('שגיאה בעדכון תבנית ברירת המחדל', { id: toastId });
    } finally {
      setIsSettingDefault(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col" dir="rtl">
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-3 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <FileText size={18} className="text-indigo-600" />
            עורך תבניות הצעת מחיר
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/price-quote-v2')} className="h-10 px-4 text-[13px] font-semibold border border-slate-300 rounded-lg hover:bg-slate-100">
              חזרה להצעה
            </button>
            <button onClick={() => loadTemplates()} disabled={isLoading} className="h-10 px-4 text-[13px] font-semibold border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1.5">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              רענן תבניות
            </button>
            <button onClick={resetToDefault} className="h-10 px-4 text-[13px] font-semibold border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 flex items-center gap-1.5">
              <RotateCcw size={14} />
              איפוס תוכן
            </button>
            <button onClick={saveTemplate} disabled={isSaving || !selectedTemplateId} className="h-10 px-5 text-[13px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 font-bold">
              <Save size={14} />
              {isSaving ? 'שומר...' : 'שמור תבנית'}
            </button>
          </div>
        </div>

        <div className="px-6 pb-3 flex flex-wrap gap-2.5 items-center border-t border-slate-100 pt-3">
          <button onClick={() => runCommand('undo')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="בטל"><Undo2 size={14} /></button>
          <button onClick={() => runCommand('redo')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="חזור"><Redo2 size={14} /></button>
          <div className="h-6 w-px bg-slate-300 mx-1" />
          <button onClick={() => runCommand('bold')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="מודגש"><Bold size={14} /></button>
          <button onClick={() => runCommand('italic')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="נטוי"><Italic size={14} /></button>
          <button onClick={() => runCommand('underline')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="קו תחתון"><Underline size={14} /></button>
          <button onClick={() => runCommand('strikeThrough')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="קו חוצה"><Strikethrough size={14} /></button>
          <div className="h-6 w-px bg-slate-300 mx-1" />
          <button onClick={() => runCommand('insertUnorderedList')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="רשימה"><List size={14} /></button>
          <button onClick={() => runCommand('insertOrderedList')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="רשימה ממוספרת"><ListOrdered size={14} /></button>
          <div className="h-6 w-px bg-slate-300 mx-1" />
          <button onClick={() => runCommand('justifyRight')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="יישור לימין"><AlignRight size={14} /></button>
          <button onClick={() => runCommand('justifyCenter')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="יישור למרכז"><AlignCenter size={14} /></button>
          <button onClick={() => runCommand('justifyLeft')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="יישור לשמאל"><AlignLeft size={14} /></button>
          <button onClick={() => runCommand('justifyFull')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="יישור דו-צדדי"><AlignJustify size={14} /></button>
          <div className="h-6 w-px bg-slate-300 mx-1" />
          <button onClick={() => runCommand('decreaseFontSize')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="הקטן גופן"><Type size={13} /></button>
          <button onClick={() => runCommand('increaseFontSize')} className="h-9 w-9 grid place-items-center border rounded-md hover:bg-slate-100" title="הגדל גופן"><Type size={16} /></button>
          <select value={fontFamily} onChange={(e) => applyFontFamily(e.target.value)} className="h-9 px-3 border rounded-md text-sm bg-white min-w-44">
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
          <select onChange={(e) => applyBlockFormat(e.target.value)} className="h-9 px-3 border rounded-md text-sm bg-white min-w-36">
            <option value="P">פסקה</option>
            <option value="H2">כותרת גדולה</option>
            <option value="H3">כותרת בינונית</option>
            <option value="H4">כותרת קטנה</option>
            <option value="BLOCKQUOTE">ציטוט</option>
          </select>
          <label className="h-9 border rounded-md px-3 bg-white text-sm flex items-center gap-2">
            צבע
            <input
              type="color"
              value={textColor}
              onChange={(e) => {
                setTextColor(e.target.value);
                runCommand('foreColor', e.target.value);
              }}
              className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              title="צבע טקסט"
            />
          </label>
          <label className="h-9 border rounded-md px-3 bg-white text-sm flex items-center gap-2">
            <Highlighter size={12} />
            סימון
            <input
              type="color"
              value={highlightColor}
              onChange={(e) => {
                setHighlightColor(e.target.value);
                runCommand('hiliteColor', e.target.value);
              }}
              className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              title="הדגשת רקע"
            />
          </label>
          <div className="mr-4 text-sm font-bold text-slate-500">
            {isDirty ? 'יש שינויים שלא נשמרו' : 'כל השינויים נשמרו'}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <div className="h-full max-w-[1600px] mx-auto grid grid-cols-[340px_1fr] gap-4">
          <aside className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-700 text-sm">תבניות</div>
              <div className="text-xs text-slate-500">{templates.length}</div>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={() => createNewTemplate()} className="flex-1 h-10 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 font-bold flex items-center justify-center gap-1.5">
                <Plus size={13} />
                חדשה
              </button>
              <button onClick={() => createNewTemplate({ duplicateCurrent: true })} className="flex-1 h-10 text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 font-bold flex items-center justify-center gap-1.5">
                <Copy size={13} />
                שכפל
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {templates.map((template) => {
                const isSelected = template.templateId === selectedTemplateId;
                const isDefault = template.templateId === activeTemplateId;
                return (
                  <button
                    key={template.templateId}
                    onClick={() => selectTemplate(template.templateId)}
                    className={`w-full text-right border rounded-lg px-3 py-2.5 transition ${
                      isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-800 truncate">{template.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      {isDefault ? <CheckCircle2 size={12} className="text-emerald-600" /> : null}
                      {isDefault ? 'ברירת מחדל' : ' '}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200 space-y-2">
              <button
                onClick={setAsDefaultTemplate}
                disabled={!selectedTemplateId || selectedTemplateId === activeTemplateId || isSettingDefault}
                className="w-full h-10 text-sm bg-emerald-600 text-white rounded-lg px-3 font-bold disabled:opacity-40"
              >
                {isSettingDefault ? 'מעדכן...' : 'קבע כברירת מחדל'}
              </button>
              <button
                onClick={deleteTemplate}
                disabled={!selectedTemplateId || templates.length <= 1}
                className="w-full h-10 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} />
                מחק תבנית
              </button>
            </div>
          </aside>

          <section className="bg-slate-200 rounded-2xl border border-slate-300 overflow-y-auto p-6">
            <div className="max-w-[1200px] mx-auto space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid md:grid-cols-5 gap-3">
                <label className="text-xs font-bold text-slate-600">
                  שם התבנית
                  <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  כותרת ההצעה
                  <input value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  סוג פעילות ברירת מחדל
                  <input value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  טקסט לפני כמות משתתפים
                  <input value={minPaxPrefix} onChange={(e) => setMinPaxPrefix(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  טקסט אחרי כמות משתתפים
                  <input value={minPaxSuffix} onChange={(e) => setMinPaxSuffix(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
                </label>
              </div>

              <div className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-xl p-[16mm] space-y-5">
                {blocks.map((block, index) => {
                  const isFirst = index === 0;
                  const isLast = index === blocks.length - 1;
                  return (
                    <div key={block.id} className="group rounded-lg border border-slate-200 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-500">
                          {block.type === 'text' ? 'פסקת טקסט' : 'טבלה'} #{index + 1}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => insertBlockAt(index, 'text')} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100">+ טקסט מעל</button>
                          <button onClick={() => insertBlockAt(index, 'table')} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100">+ טבלה מעל</button>
                          <button onClick={() => moveBlock(block.id, 'up')} disabled={isFirst} className="h-8 w-8 grid place-items-center border rounded-md bg-white hover:bg-slate-100 disabled:opacity-30" title="הזז למעלה">
                            <ArrowBigUp size={14} />
                          </button>
                          <button onClick={() => moveBlock(block.id, 'down')} disabled={isLast} className="h-8 w-8 grid place-items-center border rounded-md bg-white hover:bg-slate-100 disabled:opacity-30" title="הזז למטה">
                            <ArrowBigDown size={14} />
                          </button>
                          <button onClick={() => duplicateBlock(block.id)} className="h-8 w-8 grid place-items-center border rounded-md bg-white hover:bg-slate-100" title="שכפל בלוק">
                            <Copy size={13} />
                          </button>
                          <button onClick={() => removeBlock(block.id)} className="h-8 w-8 grid place-items-center border rounded-md bg-white text-red-600 hover:bg-red-50" title="מחק בלוק">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {block.type === 'text' ? (
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          dangerouslySetInnerHTML={{ __html: block.content || '' }}
                          onFocus={(e) => setActiveEditable(e.currentTarget)}
                          onInput={(e) => updateBlock(block.id, { content: e.currentTarget.innerHTML })}
                          className="min-h-[140px] border border-slate-200 rounded-lg px-3 py-2 text-[15px] leading-7 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      ) : (
                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <input
                              value={block.title || ''}
                              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                              className="w-full md:w-auto md:flex-1 border-b border-slate-300 bg-transparent py-1 px-1 text-sm font-bold outline-none"
                              placeholder="כותרת טבלה"
                            />
                            <div className="flex gap-1.5">
                              <button onClick={() => addTableColumn(block.id)} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100 flex items-center gap-1.5" title="הוסף עמודה">
                                <Columns3 size={12} />
                                הוסף עמודה
                              </button>
                              <button onClick={() => removeTableColumn(block.id)} disabled={block.headers.length <= 1} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100 disabled:opacity-30" title="מחק עמודה אחרונה">
                                מחק עמודה
                              </button>
                            </div>
                          </div>

                          <table className="w-full border-collapse text-sm bg-white table-fixed">
                            <thead>
                              <tr className="bg-slate-100">
                                {block.headers.map((header, colIndex) => (
                                  <th key={`${block.id}-header-${colIndex}`} className="border border-slate-300 p-2" style={{ width: `${header.width}%` }}>
                                    <input
                                      value={header.title || ''}
                                      onChange={(e) => updateTableHeader(block.id, colIndex, e.target.value)}
                                      className="w-full bg-transparent text-center outline-none font-bold"
                                    />
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr key={`${block.id}-row-${rowIndex}`}>
                                  {row.map((cell, colIndex) => (
                                    <td key={`${block.id}-cell-${rowIndex}-${colIndex}`} className="border border-slate-300 p-1">
                                      <input
                                        value={cell ?? ''}
                                        onChange={(e) => updateTableCell(block.id, rowIndex, colIndex, e.target.value)}
                                        className="w-full bg-transparent px-1 py-1 outline-none"
                                      />
                                    </td>
                                  ))}
                                  <td className="border border-slate-300 p-1 text-center w-10 bg-slate-50">
                                    <button onClick={() => removeTableRow(block.id, rowIndex)} className="text-red-500 hover:text-red-700" title="מחק שורה">
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div className="mt-3 flex flex-wrap gap-3">
                            <button onClick={() => addTableRow(block.id)} className="h-8 px-3 text-[13px] bg-indigo-50 text-indigo-700 rounded-md font-bold hover:bg-indigo-100 flex items-center gap-1.5">
                              <Plus size={12} />
                              הוסף שורה
                            </button>
                            <button onClick={() => insertBlockAt(index + 1, 'table')} className="h-8 px-3 text-[13px] bg-slate-100 text-slate-700 rounded-md font-bold hover:bg-slate-200 flex items-center gap-1.5">
                              <Table2 size={12} />
                              הוסף טבלה מתחת
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex gap-1.5">
                        <button onClick={() => insertBlockAt(index + 1, 'text')} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100">+ טקסט מתחת</button>
                        <button onClick={() => insertBlockAt(index + 1, 'table')} className="h-8 px-3 text-[13px] font-medium border rounded-md bg-white hover:bg-slate-100">+ טבלה מתחת</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="max-w-[210mm] mx-auto mt-3 flex flex-wrap justify-end gap-2">
                <button onClick={() => insertBlockAt(blocks.length, 'text')} className="bg-white border border-indigo-300 text-indigo-700 px-3 py-2 rounded hover:bg-indigo-50 text-sm font-bold flex items-center gap-1">
                  <Plus size={14} />
                  הוסף פסקת טקסט
                </button>
                <button onClick={() => insertBlockAt(blocks.length, 'table')} className="bg-white border border-amber-300 text-amber-800 px-3 py-2 rounded hover:bg-amber-50 text-sm font-bold flex items-center gap-1">
                  <Table2 size={14} />
                  הוסף טבלה
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default QuoteTemplateEditorPage;
