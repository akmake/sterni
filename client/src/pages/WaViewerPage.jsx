import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '@/utils/api';
import { connectSocket } from '@/utils/socket';
import { useAuthStore } from '@/stores/authStore';
import useLogout from '@/hooks/useLogout';
import WaMessageBubble, { fmtDay } from '@/components/whatsapp/WaMessageBubble';
import PushOptIn from '@/components/PushOptIn';
import {
    Loader2, LogOut, MessageCircle, ListTodo, FolderKanban, Send, Plus, X,
    CheckCircle2, Eye, Clock, CalendarDays, ChevronDown,
} from 'lucide-react';

/**
 * WaViewerPage — /wa-view (מחוץ ל-Layout)
 * צפייה בשיחה עם איש הקשר שבמעקב + (אם הוגדר User.taskTargetUser) יצירת מטלות ופרויקטים למשתמש היעד.
 * גישה: role 'wa-viewer' או admin.
 *
 * פריסה: דסקטופ — צ'אט + פאנל צד קבוע (מטלות/פרויקטים). מובייל — סרגל לשוניות תחתון.
 * זמן אמת (Socket.IO): 'wa-view:changed' → מושך הודעות (changedSince); 'assignments:changed' → מרענן מטלות/פרויקטים.
 * גיבוי: polling כל 15ש + רענון בחזרה לאפליקציה.
 *
 * API: GET /api/wa-view/messages, GET /api/wa-view/assignments, POST /api/wa-view/tasks, POST /api/wa-view/projects
 */

const POLL_MS = 15_000;
const LAST_SEEN_KEY = 'waView:lastSeen';

const readLastSeen = () => { try { return localStorage.getItem(LAST_SEEN_KEY) || null; } catch (_) { return null; } };
const writeLastSeen = (iso) => { try { localStorage.setItem(LAST_SEEN_KEY, iso); } catch (_) { /* ignore */ } };

const mergeById = (prev, incoming) => {
    const map = new Map(prev.map((m) => [m.id, m]));
    for (const m of incoming) map.set(m.id, { ...(map.get(m.id) || {}), ...m });
    return [...map.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const relTime = (ts) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'עכשיו';
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
    return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

// ============================================================
// ===  STATUS PILL  ===
// ============================================================
function StatusPill({ done, seen }) {
    if (done) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> בוצע</span>;
    if (seen) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5"><Eye className="w-3 h-3" /> נראה</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" /> נשלח</span>;
}

function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium
            ${toast.error ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
            {toast.text}
        </div>
    );
}

// ============================================================
// ===  TASKS VIEW  ===
// ============================================================
function TasksView({ targetName, tasks, onCreated, notify }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef(null);

    const send = async () => {
        const t = text.trim();
        if (!t || sending) return;
        setSending(true);
        try {
            await api.post('/wa-view/tasks', { text: t });
            setText('');
            notify(`המטלה נשלחה ל${targetName}`);
            onCreated();
            inputRef.current?.focus();
        } catch (err) {
            notify(err.response?.data?.message || 'שגיאה ביצירת המטלה', true);
        } finally {
            setSending(false);
        }
    };

    const open = tasks.filter((t) => !t.isCompleted);
    const done = tasks.filter((t) => t.isCompleted);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 focus-within:ring-2 focus-within:ring-emerald-500/30 transition">
                <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`מטלה חדשה עבור ${targetName}…`}
                    className="w-full resize-none outline-none text-[15px] text-slate-800 placeholder-slate-400 bg-transparent" />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">Enter לשליחה · Shift+Enter לשורה חדשה</span>
                    <button onClick={send} disabled={!text.trim() || sending}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-4 py-2 disabled:opacity-40 transition">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} שליחה
                    </button>
                </div>
            </div>

            <Section title="פתוחות" count={open.length}>
                {open.length === 0 ? <Empty text="אין מטלות פתוחות" /> : open.map((t) => <TaskRow key={t._id} t={t} />)}
            </Section>
            {done.length > 0 && (
                <Section title="בוצעו" count={done.length} collapsible>
                    {done.map((t) => <TaskRow key={t._id} t={t} />)}
                </Section>
            )}
        </div>
    );
}

function TaskRow({ t }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-3 flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center
                ${t.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                {t.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className={`text-[14px] leading-snug whitespace-pre-wrap break-words ${t.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.text}</div>
                <div className="flex items-center gap-2 mt-1.5">
                    <StatusPill done={t.isCompleted} seen={!!t.seenAt} />
                    <span className="text-[11px] text-slate-400">{relTime(t.createdAt)}</span>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// ===  PROJECTS VIEW  ===
// ============================================================
function ProjectsView({ targetName, projects, onCreated, notify }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [subTask, setSubTask] = useState('');
    const [subTasks, setSubTasks] = useState([]);
    const [saving, setSaving] = useState(false);

    const addSub = () => {
        const v = subTask.trim();
        if (!v) return;
        setSubTasks((s) => [...s, v]);
        setSubTask('');
    };

    const reset = () => { setName(''); setDescription(''); setDueDate(''); setSubTask(''); setSubTasks([]); };

    const create = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        try {
            const pending = subTask.trim() ? [...subTasks, subTask.trim()] : subTasks;
            await api.post('/wa-view/projects', { projectName: name.trim(), description, dueDate: dueDate || undefined, tasks: pending });
            notify(`הפרויקט נשלח ל${targetName}`);
            reset();
            setOpen(false);
            onCreated();
        } catch (err) {
            notify(err.response?.data?.message || 'שגיאה ביצירת הפרויקט', true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {!open ? (
                <button onClick={() => setOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 border-2 border-dashed border-slate-300 hover:border-emerald-400 text-slate-600 hover:text-emerald-700 rounded-2xl py-4 font-semibold transition">
                    <Plus className="w-5 h-5" /> פרויקט חדש עבור {targetName}
                </button>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                        <span className="font-semibold text-slate-800 flex items-center gap-2"><FolderKanban className="w-4 h-4 text-emerald-600" /> פרויקט חדש</span>
                        <button onClick={() => { setOpen(false); reset(); }} className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-500"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="p-4 space-y-3">
                        <Field label="שם הפרויקט *">
                            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus
                                placeholder="למשל: שיפוץ המטבח" className="input-base" />
                        </Field>
                        <Field label="תיאור">
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000}
                                placeholder="פרטים, הקשר, מה המטרה…" className="input-base resize-none" />
                        </Field>
                        <Field label="תאריך יעד">
                            <div className="relative">
                                <CalendarDays className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-base pr-9" />
                            </div>
                        </Field>
                        <Field label={`משימות בפרויקט${subTasks.length ? ` (${subTasks.length})` : ''}`}>
                            {subTasks.length > 0 && (
                                <ul className="space-y-1.5 mb-2">
                                    {subTasks.map((s, i) => (
                                        <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700">
                                            <span className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                                            <span className="flex-1 break-words">{s}</span>
                                            <button onClick={() => setSubTasks(subTasks.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2">
                                <input value={subTask} onChange={(e) => setSubTask(e.target.value)} maxLength={500}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
                                    placeholder="הוסף משימה ולחץ Enter" className="input-base flex-1" />
                                <button onClick={addSub} disabled={!subTask.trim()} className="px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </Field>
                    </div>
                    <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                        <button onClick={() => { setOpen(false); reset(); }} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-200/60">ביטול</button>
                        <button onClick={create} disabled={!name.trim() || saving}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-5 py-2 disabled:opacity-40">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} צור ושלח
                        </button>
                    </div>
                </div>
            )}

            <Section title="פרויקטים ששלחתי" count={projects.length}>
                {projects.length === 0 ? <Empty text="עוד לא נשלחו פרויקטים" /> : projects.map((p) => (
                    <div key={p._id} className="bg-white rounded-xl border border-slate-200 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-slate-800 text-[14px] break-words">{p.projectName}</div>
                            <StatusPill done={p.taskCount > 0 && p.progress === 100} seen={!!p.seenAt} />
                        </div>
                        {p.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</div>}
                        <div className="mt-3">
                            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                                <span>{p.taskCount ? `${p.doneCount}/${p.taskCount} משימות` : 'אין משימות'}</span>
                                <span>{p.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                            <span>{relTime(p.createdAt)}</span>
                            {p.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> יעד: {new Date(p.dueDate).toLocaleDateString('he-IL')}</span>}
                        </div>
                    </div>
                ))}
            </Section>
        </div>
    );
}

// ── UI helpers ──
function Field({ label, children }) {
    return (
        <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
            {children}
        </label>
    );
}

function Section({ title, count, children, collapsible = false }) {
    const [open, setOpen] = useState(!collapsible);
    return (
        <div>
            <button onClick={() => collapsible && setOpen(!open)} className={`flex items-center gap-2 mb-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</span>
                <span className="text-[11px] bg-slate-200 text-slate-600 rounded-full px-1.5">{count}</span>
                {collapsible && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />}
            </button>
            {open && <div className="space-y-2">{children}</div>}
        </div>
    );
}

const Empty = ({ text }) => <div className="text-sm text-slate-400 text-center py-6 bg-white/60 rounded-xl border border-dashed border-slate-200">{text}</div>;

// ============================================================
// ===  ASSIGNMENTS PANEL (tasks + projects tabs)  ===
// ============================================================
function AssignmentsPanel({ data, tab, setTab, reload, notify, showTabs = true }) {
    const openTasks = data.tasks.filter((t) => !t.isCompleted).length;
    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="px-4 pt-4 pb-3 border-b border-slate-200 bg-white">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">שליחה אל</div>
                <div className="text-lg font-bold text-slate-900">{data.targetName}</div>
                {showTabs && (
                    <div className="mt-3 grid grid-cols-2 bg-slate-100 rounded-xl p-1">
                        {[['tasks', 'מטלות', ListTodo, openTasks], ['projects', 'פרויקטים', FolderKanban, data.projects.length]].map(([key, label, Icon, n]) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition
                                    ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon className="w-4 h-4" /> {label}
                                {n > 0 && <span className={`text-[10px] rounded-full px-1.5 ${tab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{n}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {tab === 'tasks'
                    ? <TasksView targetName={data.targetName} tasks={data.tasks} onCreated={reload} notify={notify} />
                    : <ProjectsView targetName={data.targetName} projects={data.projects} onCreated={reload} notify={notify} />}
            </div>
        </div>
    );
}

// ============================================================
// ===  MAIN  ===
// ============================================================
function WaViewerContent() {
    const [messages, setMessages] = useState([]);
    const [contact, setContact] = useState(null);
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const [live, setLive] = useState(false);
    const [assign, setAssign] = useState({ enabled: false, targetName: null, tasks: [], projects: [] });
    const [mobileView, setMobileView] = useState('chat'); // chat | tasks | projects
    const [panelTab, setPanelTab] = useState('tasks');
    const [toast, setToast] = useState(null);
    const { mutate: logout } = useLogout();

    const lastSeenAtLoad = useRef(readLastSeen());
    const serverTimeRef = useRef(null);
    const scrollRef = useRef(null);
    const stickToBottom = useRef(true);
    const toastTimer = useRef(null);

    const notify = useCallback((text, err = false) => {
        setToast({ text, error: err });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3000);
    }, []);

    const markSeen = (list) => {
        const newest = list[list.length - 1]?.timestamp;
        if (newest && (!readLastSeen() || newest > readLastSeen())) writeLastSeen(newest);
    };

    // ── מטלות/פרויקטים ──
    const loadAssignments = useCallback(async () => {
        try {
            const { data } = await api.get('/wa-view/assignments');
            setAssign(data);
        } catch (_) { /* ignore */ }
    }, []);

    // ── טעינה ראשונית ──
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/wa-view/messages', { params: { limit: 300 } });
                setMessages(data.messages);
                setContact(data.contact);
                setNotice(data.notice || '');
                setHasMore(data.hasMore);
                serverTimeRef.current = data.serverTime;
                markSeen(data.messages);
            } catch (err) {
                setError(err.response?.data?.message || 'שגיאה בטעינת ההודעות');
            } finally {
                setLoading(false);
            }
        })();
        loadAssignments();
    }, [loadAssignments]);

    // ── משיכת חדשות + שינויים ──
    const poll = useCallback(async () => {
        if (!serverTimeRef.current) return;
        try {
            const { data } = await api.get('/wa-view/messages', { params: { changedSince: serverTimeRef.current, limit: 500 } });
            serverTimeRef.current = data.serverTime;
            if (data.contact) setContact(data.contact);
            if (data.messages.length) {
                setMessages((prev) => {
                    const next = mergeById(prev, data.messages);
                    markSeen(next);
                    return next;
                });
            }
        } catch (_) { /* ננסה שוב */ }
    }, []);

    // ── זמן אמת + גיבוי ──
    useEffect(() => {
        const socket = connectSocket();
        const onConnect = () => { setLive(true); poll(); loadAssignments(); };
        const onDisconnect = () => setLive(false);
        socket?.on('connect', onConnect);
        socket?.on('disconnect', onDisconnect);
        socket?.on('wa-view:changed', poll);
        socket?.on('assignments:changed', loadAssignments);
        if (socket?.connected) setLive(true);

        const t = setInterval(poll, POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') { poll(); loadAssignments(); } };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            socket?.off('connect', onConnect);
            socket?.off('disconnect', onDisconnect);
            socket?.off('wa-view:changed', poll);
            socket?.off('assignments:changed', loadAssignments);
            clearInterval(t);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [poll, loadAssignments]);

    const loadOlder = async () => {
        if (!messages.length) return;
        setLoadingOlder(true);
        const el = scrollRef.current;
        const prevHeight = el?.scrollHeight || 0;
        try {
            const { data } = await api.get('/wa-view/messages', { params: { before: messages[0].timestamp, limit: 300 } });
            stickToBottom.current = false;
            setMessages((prev) => mergeById(prev, data.messages));
            setHasMore(data.hasMore);
            requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
        } catch (_) { /* ignore */ } finally {
            setLoadingOlder(false);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [messages, mobileView]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    const contactLabel = contact?.name || contact?.phone || 'איש הקשר';
    const lastSeen = lastSeenAtLoad.current;

    const rows = useMemo(() => {
        const out = [];
        let prevDay = null;
        let newDividerPlaced = false;
        for (const m of messages) {
            const day = new Date(m.timestamp).toDateString();
            if (day !== prevDay) { out.push({ kind: 'day', key: `d-${day}`, ts: m.timestamp }); prevDay = day; }
            const isNew = !!lastSeen && m.timestamp > lastSeen;
            if (isNew && !newDividerPlaced) { out.push({ kind: 'new', key: 'new-divider' }); newDividerPlaced = true; }
            out.push({ kind: 'msg', key: m.id, msg: m, isNew });
        }
        return out;
    }, [messages, lastSeen]);

    const newCount = lastSeen ? messages.filter((m) => m.timestamp > lastSeen).length : 0;
    const openTasks = assign.tasks.filter((t) => !t.isCompleted).length;

    const chat = (
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-3 md:px-8 py-4 space-y-2 bg-[#efeae2]">
            {loading ? (
                <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-7 h-7 animate-spin" /></div>
            ) : error ? (
                <div className="text-center text-red-600 py-16">{error}</div>
            ) : notice ? (
                <div className="flex flex-col items-center gap-2 text-slate-500 py-16"><MessageCircle className="w-10 h-10" /> {notice}</div>
            ) : messages.length === 0 ? (
                <div className="text-center text-slate-500 py-16">אין הודעות עדיין</div>
            ) : (
                <>
                    {hasMore && (
                        <div className="flex justify-center">
                            <button onClick={loadOlder} disabled={loadingOlder}
                                className="text-xs bg-white/90 rounded-full px-3 py-1 shadow text-slate-700 hover:bg-white disabled:opacity-50">
                                {loadingOlder ? 'טוען…' : 'הצג הודעות קודמות'}
                            </button>
                        </div>
                    )}
                    {rows.map((r) => r.kind === 'day' ? (
                        <div key={r.key} className="flex justify-center py-1 sticky top-0 z-10">
                            <span className="bg-white/95 text-slate-600 text-xs rounded-lg px-3 py-1 shadow-sm">{fmtDay(r.ts)}</span>
                        </div>
                    ) : r.kind === 'new' ? (
                        <div key={r.key} className="flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-amber-400" />
                            <span className="text-xs font-semibold text-amber-700">הודעות חדשות מאז הביקור הקודם</span>
                            <div className="flex-1 h-px bg-amber-400" />
                        </div>
                    ) : (
                        <WaMessageBubble key={r.key} msg={r.msg} isNew={r.isNew} showId contactLabel={contactLabel} />
                    ))}
                </>
            )}
        </div>
    );

    return (
        <div dir="rtl" className="h-[100dvh] flex flex-col bg-slate-100">
            {/* ── App bar ── */}
            <header className="shrink-0 px-4 py-3 bg-gradient-to-l from-[#008069] to-[#00a884] text-white flex items-center gap-3 shadow-md z-20">
                <div className="w-10 h-10 rounded-full bg-white/20 ring-2 ring-white/30 flex items-center justify-center font-bold text-lg">
                    {contactLabel.replace('+', '').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate leading-tight">{contactLabel}</div>
                    <div className="flex items-center gap-2 text-[11px] text-white/85">
                        {contact?.phone && <span dir="ltr">+{contact.phone}</span>}
                        <span className="inline-flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-lime-300 animate-pulse' : 'bg-white/50'}`} />
                            {live ? 'מתעדכן בזמן אמת' : 'מתחבר…'}
                        </span>
                    </div>
                </div>
                {newCount > 0 && <span className="bg-amber-400 text-white text-xs font-semibold rounded-full px-2.5 py-1">{newCount} חדשות</span>}
                <PushOptIn compact />
                <button onClick={() => logout()} title="יציאה" className="p-2 rounded-lg hover:bg-white/15">
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex">
                {/* דסקטופ: צ'אט + פאנל צד */}
                <main className={`flex-1 min-w-0 ${assign.enabled && mobileView !== 'chat' ? 'hidden md:block' : 'block'}`}>
                    {chat}
                </main>
                {assign.enabled && (
                    <>
                        <aside className="hidden md:block w-[400px] shrink-0 border-r border-slate-200 shadow-[0_0_20px_rgba(0,0,0,0.04)]">
                            <AssignmentsPanel data={assign} tab={panelTab} setTab={setPanelTab} reload={loadAssignments} notify={notify} />
                        </aside>
                        {/* מובייל: מטלות/פרויקטים במסך מלא */}
                        {mobileView !== 'chat' && (
                            <section className="md:hidden flex-1 min-w-0">
                                <AssignmentsPanel data={assign} tab={mobileView} setTab={setMobileView} reload={loadAssignments} notify={notify} showTabs={false} />
                            </section>
                        )}
                    </>
                )}
            </div>

            {/* ── Bottom tabs (mobile) ── */}
            {assign.enabled && (
                <nav className="md:hidden shrink-0 grid grid-cols-3 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
                    {[
                        ['chat', "צ'אט", MessageCircle, newCount],
                        ['tasks', 'מטלות', ListTodo, openTasks],
                        ['projects', 'פרויקטים', FolderKanban, 0],
                    ].map(([key, label, Icon, n]) => (
                        <button key={key} onClick={() => setMobileView(key)}
                            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition
                                ${mobileView === key ? 'text-emerald-700' : 'text-slate-500'}`}>
                            <Icon className="w-5 h-5" />
                            {label}
                            {n > 0 && <span className="absolute top-1 left-1/2 translate-x-3 bg-emerald-600 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{n}</span>}
                            {mobileView === key && <span className="absolute top-0 inset-x-6 h-0.5 bg-emerald-600 rounded-full" />}
                        </button>
                    ))}
                </nav>
            )}

            <Toast toast={toast} />
            <style>{`.input-base{width:100%;border:1px solid rgb(226 232 240);border-radius:0.75rem;padding:0.55rem 0.75rem;font-size:14px;outline:none;background:white;color:rgb(30 41 59)}.input-base:focus{border-color:rgb(16 185 129);box-shadow:0 0 0 3px rgb(16 185 129 / 0.15)}`}</style>
        </div>
    );
}

/** שומר: מחובר + (wa-viewer או admin) */
export default function WaViewerPage() {
    const { isAuthenticated, user } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!['wa-viewer', 'admin'].includes(user?.role)) return <Navigate to="/" replace />;
    return <WaViewerContent />;
}
