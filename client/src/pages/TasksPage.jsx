import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import { Plus, Trash2, Check, Loader2, ArrowUpRight, Pencil, ChevronDown, RotateCcw, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { connectSocket } from '../utils/socket';
import PushOptIn from '../components/PushOptIn';
import ActionMenu from '../components/ui/ActionMenu';

/**
 * TasksPage — /tasks (מטלות מהירות)
 * מובייל-first: שורה = עיגול סימון + טקסט ברוחב מלא + תפריט ⋮ (עריכה / הפוך לפרויקט / מחיקה).
 * מחיקה עם "ביטול" (undo) ל-5 שניות. זמן אמת: socket 'tasks:changed'. מטלות שהוקצו לי: "מאת …" + "חדש".
 */

const UNDO_MS = 5000;
const isFinePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

const relDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `היום ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
  if (d.toDateString() === y.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

const fromLabel = (task) => task.sourceLabel || task.createdBy?.name || '';

// ── עריכה: textarea שגדל עם הטקסט ──
function EditBox({ value, onChange, onSave, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <div className="flex-1 min-w-0">
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
          if (e.key === 'Escape') onCancel();
        }}
        className="w-full resize-none bg-slate-50 rounded-xl px-3 py-2 text-[16px] leading-relaxed text-slate-800 outline-none ring-2 ring-blue-500/30 focus:ring-blue-500/50"
      />
      <div className="flex gap-2 mt-2">
        <button onMouseDown={(e) => e.preventDefault()} onClick={onSave}
          className="inline-flex items-center gap-1 bg-slate-900 text-white text-sm font-semibold rounded-lg px-3 py-1.5">
          <Check size={14} /> שמור
        </button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={onCancel}
          className="text-sm text-slate-500 rounded-lg px-3 py-1.5 hover:bg-slate-100">ביטול</button>
      </div>
    </div>
  );
}

const TasksPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [undo, setUndo] = useState(null); // { task, timer }
  const pendingDeletes = useRef(new Set());

  // silent = רענון ברקע (סוקט / חזרה לאפליקציה) בלי ספינר
  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/tasks');
      // מטלות שמחכות למחיקה (חלון ה-undo) — לא להחזיר אותן לרשימה
      setTasks(res.data.filter((t) => !pendingDeletes.current.has(t._id)));
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── זמן אמת: מטלה שמישהו יצר עבורי מופיעה מיד (assignmentNotifier → 'tasks:changed') ──
  useEffect(() => {
    const socket = connectSocket();
    const onChanged = () => fetchTasks(true);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTasks(true); };
    socket?.on('tasks:changed', onChanged);
    socket?.on('connect', onChanged); // אחרי ניתוק — לא לפספס מה שנוצר בינתיים
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket?.off('tasks:changed', onChanged);
      socket?.off('connect', onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchTasks]);

  // מטלות שהוקצו לי ועוד לא נראו — מסמנים כנראו כשהעמוד גלוי (עוצר את התזכורות)
  const unseenIds = tasks.filter(t => t.createdBy && !t.seenAt && !t.isCompleted).map(t => t._id).join(',');
  useEffect(() => {
    if (!unseenIds) return undefined;
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      api.post('/tasks/seen', { ids: unseenIds.split(',') }).catch(() => {});
    };
    const t = setTimeout(mark, 1500);
    document.addEventListener('visibilitychange', mark);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', mark); };
  }, [unseenIds]);

  // מחיקה שממתינה בזמן יציאה מהעמוד — מבצעים אותה
  useEffect(() => () => {
    pendingDeletes.current.forEach((id) => api.delete(`/tasks/${id}`).catch(() => {}));
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await api.post('/tasks', { text });
      setTasks((prev) => [res.data, ...prev]);
      setNewTask('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (id, currentStatus) => {
    setTasks(prev => prev.map(t => t._id === id ? { ...t, isCompleted: !currentStatus } : t));
    try {
      await api.patch(`/tasks/${id}`, { isCompleted: !currentStatus });
    } catch (err) {
      console.error(err);
      fetchTasks(true);
    }
  };

  const commitDelete = (id) => {
    pendingDeletes.current.delete(id);
    api.delete(`/tasks/${id}`).catch((err) => { console.error(err); fetchTasks(true); });
  };

  const deleteTask = (task) => {
    if (undo) { clearTimeout(undo.timer); commitDelete(undo.task._id); }
    pendingDeletes.current.add(task._id);
    setTasks(prev => prev.filter(t => t._id !== task._id));
    const timer = setTimeout(() => { commitDelete(task._id); setUndo(null); }, UNDO_MS);
    setUndo({ task, timer });
  };

  const undoDelete = () => {
    if (!undo) return;
    clearTimeout(undo.timer);
    pendingDeletes.current.delete(undo.task._id);
    setTasks(prev => [undo.task, ...prev.filter(t => t._id !== undo.task._id)]);
    setUndo(null);
  };

  const convertToProject = async (id) => {
    if (!window.confirm('להפוך מטלה זו לפרויקט חדש? המטלה תוסר מהרשימה.')) return;
    try {
      const res = await api.post(`/tasks/${id}/convert`);
      setTasks(prev => prev.filter(t => t._id !== id));
      navigate(`/projects/${res.data.newProject._id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (task) => {
    setEditingId(task._id);
    setEditValue(task.text);
  };

  const saveEdit = async () => {
    const val = editValue.trim();
    const id = editingId;
    setEditingId(null);
    if (!val || !id) return;
    setTasks(prev => prev.map(t => t._id === id ? { ...t, text: val } : t));
    try {
      await api.patch(`/tasks/${id}`, { text: val });
    } catch (err) {
      console.error(err);
      fetchTasks(true);
    }
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);
  const todayDate = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-full bg-[#F5F5F7] px-4 pt-4 pb-28 md:p-8 font-sans text-[#1D1D1F]">
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <header className="mb-5 md:mb-8">
          <p className="text-slate-500 font-medium text-[13px] mb-0.5">{todayDate}</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[28px] md:text-4xl font-bold tracking-tight leading-tight">מטלות לביצוע</h1>
            <span className="shrink-0 text-[13px] font-semibold bg-white px-3 py-1 rounded-full text-slate-500 shadow-sm border border-slate-100 tabular-nums">
              {activeTasks.length} פתוחות
            </span>
          </div>
          <PushOptIn className="mt-3" />
        </header>

        {/* ── Add task ── */}
        <form onSubmit={handleAddTask} className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3 mb-3 bg-[#F5F5F7]/90 backdrop-blur md:static md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-0">
          <div className="flex items-center gap-2 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-slate-100 pr-4 pl-1.5 py-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-200 transition">
            <Plus size={20} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="מטלה חדשה…"
              enterKeyHint="done"
              className="flex-1 min-w-0 bg-transparent py-2.5 text-[16px] placeholder-slate-400 outline-none"
              autoFocus={isFinePointer()}
            />
            <button type="submit" disabled={!newTask.trim() || submitting}
              className="shrink-0 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-0 disabled:pointer-events-none transition-opacity flex items-center gap-1.5">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CornerDownLeft size={16} />}
              <span className="hidden sm:inline">הוסף</span>
            </button>
          </div>
        </form>

        {/* ── Active ── */}
        <div className="space-y-2 mb-8">
          {loading && tasks.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-[60px] bg-white/70 rounded-2xl animate-pulse" />)}
            </div>
          ) : activeTasks.map(task => {
            const from = task.createdBy ? fromLabel(task) : '';
            const isNew = task.createdBy && !task.seenAt;
            return (
              <div key={task._id}
                className={`bg-white rounded-2xl flex items-start gap-3 pr-3 pl-1.5 py-3 shadow-sm border transition-colors
                  ${isNew ? 'border-amber-300 ring-2 ring-amber-200/60' : 'border-slate-100/80'}`}>
                <button
                  onClick={() => toggleTask(task._id, false)}
                  aria-label="סמן כבוצע"
                  className="shrink-0 w-7 h-7 mt-0.5 rounded-full border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 active:scale-90 transition flex items-center justify-center group/check"
                >
                  <Check size={14} strokeWidth={3} className="text-blue-500 opacity-0 group-hover/check:opacity-100" />
                </button>

                {editingId === task._id ? (
                  <EditBox value={editValue} onChange={setEditValue} onSave={saveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="flex-1 min-w-0 pt-0.5" onDoubleClick={() => startEditing(task)}>
                    <p className="text-[16px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">{task.text}</p>
                    {(from || isNew) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {from && <span className="text-[12px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">מאת {from}</span>}
                        {isNew && <span className="text-[11px] font-bold bg-amber-400 text-white rounded-full px-2 py-0.5">חדש</span>}
                        <span className="text-[11px] text-slate-400">{relDate(task.createdAt)}</span>
                      </div>
                    )}
                  </div>
                )}

                {editingId !== task._id && (
                  <ActionMenu items={[
                    { label: 'עריכה', icon: Pencil, onClick: () => startEditing(task) },
                    { label: 'הפוך לפרויקט', icon: ArrowUpRight, onClick: () => convertToProject(task._id) },
                    { label: 'מחיקה', icon: Trash2, onClick: () => deleteTask(task), danger: true, separatorBefore: true },
                  ]} />
                )}
              </div>
            );
          })}

          {activeTasks.length === 0 && !loading && (
            <div className="text-center py-14">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Check size={30} className="text-emerald-500" />
              </div>
              <p className="text-[17px] font-semibold text-slate-700">הכל בוצע!</p>
              <p className="text-sm text-slate-400 mt-1">אין מטלות פתוחות</p>
            </div>
          )}
        </div>

        {/* ── Completed ── */}
        {completedTasks.length > 0 && (
          <section>
            <button onClick={() => setShowDone(v => !v)}
              className="w-full flex items-center justify-between px-1 py-2 text-slate-500 hover:text-slate-700">
              <span className="text-[13px] font-bold">הושלמו ({completedTasks.length})</span>
              <ChevronDown size={18} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
            </button>
            {showDone && (
              <div className="space-y-1 mt-1">
                {completedTasks.map(task => (
                  <div key={task._id} className="flex items-start gap-3 pr-3 pl-1.5 py-2.5 rounded-xl bg-white/50">
                    <button onClick={() => toggleTask(task._id, true)} aria-label="החזר לפתוחות"
                      className="shrink-0 w-7 h-7 mt-0.5 rounded-full bg-blue-500 flex items-center justify-center active:scale-90 transition">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </button>
                    <span className="flex-1 min-w-0 pt-1 text-[15px] text-slate-400 line-through decoration-slate-300 whitespace-pre-wrap break-words">{task.text}</span>
                    <ActionMenu items={[
                      { label: 'החזר לפתוחות', icon: RotateCcw, onClick: () => toggleTask(task._id, true) },
                      { label: 'מחיקה', icon: Trash2, onClick: () => deleteTask(task), danger: true, separatorBefore: true },
                    ]} />
                  </div>
                ))}
                <p className="text-center text-xs text-slate-400 pt-3">משימות שהושלמו נמחקות אוטומטית אחרי 30 יום</p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Undo snackbar ── */}
      {undo && (
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 bg-slate-900 text-white rounded-2xl shadow-2xl pr-4 pl-2 py-2 max-w-md w-full">
            <span className="flex-1 text-sm truncate">המטלה נמחקה</span>
            <button onClick={undoDelete} className="text-sm font-bold text-sky-300 hover:text-sky-200 px-3 py-1.5 rounded-lg hover:bg-white/10">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
