import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import useLogout from '@/hooks/useLogout';
import WaMessageBubble, { fmtDay } from '@/components/whatsapp/WaMessageBubble';
import { Loader2, LogOut, MessageCircle } from 'lucide-react';

/**
 * WaViewerPage — /wa-view
 * צפייה בלבד בשיחה עם איש הקשר שנבחר בהגדרות פאנל המעקב.
 * מחוץ ל-Layout: בלי תפריט, בלי רשימת צ'אטים, בלי כפתורי עריכה.
 * גישה: role 'wa-viewer' (משתמש צופה) או admin.
 *
 * API: GET /api/wa-view/messages (+ since / afterId / changedSince / before), GET /api/wa-view/media/:id
 * "חדש": הודעות שנשלחו אחרי הביקור הקודם בעמוד (נשמר ב-localStorage בדפדפן).
 */

const POLL_MS = 10_000;
const LAST_SEEN_KEY = 'waView:lastSeen';

const readLastSeen = () => {
    try { return localStorage.getItem(LAST_SEEN_KEY) || null; } catch (_) { return null; }
};
const writeLastSeen = (iso) => {
    try { localStorage.setItem(LAST_SEEN_KEY, iso); } catch (_) { /* ignore */ }
};

const mergeById = (prev, incoming) => {
    const map = new Map(prev.map((m) => [m.id, m]));
    for (const m of incoming) map.set(m.id, { ...(map.get(m.id) || {}), ...m });
    return [...map.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

function WaViewerContent() {
    const [messages, setMessages] = useState([]);
    const [contact, setContact] = useState(null);
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const { mutate: logout } = useLogout();

    // הזמן של הביקור הקודם — נקבע פעם אחת בטעינת העמוד
    const lastSeenAtLoad = useRef(readLastSeen());
    const serverTimeRef = useRef(null);
    const scrollRef = useRef(null);
    const stickToBottom = useRef(true);

    const markSeen = (list) => {
        const newest = list[list.length - 1]?.timestamp;
        if (newest && (!readLastSeen() || newest > readLastSeen())) writeLastSeen(newest);
    };

    // טעינה ראשונית
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
    }, []);

    // רענון: הודעות חדשות + שינויים (עריכה/מחיקה/קובץ שירד)
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
        } catch (_) { /* ננסה שוב בסבב הבא */ }
    }, []);

    useEffect(() => {
        const t = setInterval(poll, POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
    }, [poll]);

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

    // גלילה לתחתית כשמגיעות הודעות חדשות (אם המשתמש כבר בתחתית)
    useEffect(() => {
        const el = scrollRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    const contactLabel = contact?.name || contact?.phone || 'איש הקשר';
    const lastSeen = lastSeenAtLoad.current;

    // הודעות + מפרידי יום + קו "הודעות חדשות"
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

    return (
        <div dir="rtl" className="h-screen flex flex-col bg-[#efeae2]">
            <header className="px-4 py-3 bg-[#008069] text-white flex items-center gap-3 shadow">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    {contactLabel.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{contactLabel}</div>
                    <div className="text-xs text-white/80" dir="ltr">{contact?.phone ? `+${contact.phone}` : ''}</div>
                </div>
                {newCount > 0 && <span className="bg-amber-400 text-white text-xs rounded-full px-2 py-0.5">{newCount} חדשות</span>}
                <button onClick={() => logout()} title="יציאה" className="p-2 rounded hover:bg-white/20">
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 md:px-8 py-4 space-y-2">
                {loading ? (
                    <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-7 h-7 animate-spin" /></div>
                ) : error ? (
                    <div className="text-center text-red-600 py-16">{error}</div>
                ) : notice ? (
                    <div className="flex flex-col items-center gap-2 text-gray-500 py-16">
                        <MessageCircle className="w-10 h-10" /> {notice}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-16">אין הודעות עדיין</div>
                ) : (
                    <>
                        {hasMore && (
                            <div className="flex justify-center">
                                <button onClick={loadOlder} disabled={loadingOlder}
                                    className="text-xs bg-white/80 rounded-full px-3 py-1 shadow text-gray-700 hover:bg-white disabled:opacity-50">
                                    {loadingOlder ? 'טוען...' : 'הצג הודעות קודמות'}
                                </button>
                            </div>
                        )}
                        {rows.map((r) => r.kind === 'day' ? (
                            <div key={r.key} className="flex justify-center py-1">
                                <span className="bg-white/90 text-gray-600 text-xs rounded-lg px-3 py-1 shadow-sm">{fmtDay(r.ts)}</span>
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
