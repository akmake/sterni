import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { getSocket, connectSocket } from '@/utils/socket';
import WaMessageBubble, { toBubbleMessage, fmtDay } from '@/components/whatsapp/WaMessageBubble';
import {
    MessageCircle, Search, RefreshCw, LogOut, ArrowRight, Loader2, Settings, Eye, X, Trash2, Plus,
} from 'lucide-react';

/**
 * WhatsAppMonitorPage — /admin/whatsapp-monitor (admin)
 * פאנל בסגנון וואצפ ווב לחיבור המעקב + הגדרות "מעקב אחרי אדם ספציפי".
 * הצופה (role 'wa-viewer') רואה רק את /wa-view — WaViewerPage.jsx.
 *
 * Socket: wa-monitor:message (הודעה חדשה), wa-monitor:update (עריכה/מחיקה/ריאקציה/מדיה ירדה), wa-monitor:status
 */

const POLL_MS = 5000;

const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const fmtChatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) return fmtTime(ts);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const chatTitle = (c) => c?.contactName || c?.name || (c?.phone ? `+${c.phone}` : 'לא מזוהה (LID)');

const initialOf = (c) => chatTitle(c).replace('+', '').trim().charAt(0).toUpperCase() || '?';

const mergeMessages = (prev, incoming) => {
    const map = new Map(prev.map((m) => [m.messageId, m]));
    for (const m of incoming) map.set(m.messageId, { ...(map.get(m.messageId) || {}), ...m });
    return [...map.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

// ============================================================
// ===  QR / CONNECT GATE  ===
// ============================================================
function ConnectPanel({ status, qr, onRefresh, onConnect }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-4">
            <MessageCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-bold text-gray-800">חיבור WhatsApp לפאנל</h2>

            {status === 'connecting' && qr ? (
                <>
                    <p className="text-gray-600">סרוק את ה-QR מהוואצפ בטלפון שלך:<br />
                        <span className="text-sm text-gray-400">הגדרות ← מכשירים מקושרים ← קישור מכשיר</span>
                    </p>
                    <img src={qr} alt="QR Code" className="w-64 h-64 border rounded-lg shadow" />
                    <button onClick={onRefresh}
                        className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700">
                        <RefreshCw className="w-4 h-4" /> רענן קוד
                    </button>
                </>
            ) : status === 'connecting' ? (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p>מתחבר... מייצר קוד QR</p>
                </div>
            ) : (
                <>
                    <p className="text-gray-600">החיבור אינו פעיל. לחץ כדי להתחיל ולקבל קוד QR.</p>
                    <button onClick={onConnect}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold">
                        התחבר
                    </button>
                </>
            )}
        </div>
    );
}

// ============================================================
// ===  SETTINGS MODAL — מעקב אחרי אדם ספציפי  ===
// ============================================================
function SettingsModal({ onClose, onSaved }) {
    const [chats, setChats] = useState([]);
    const [mode, setMode] = useState('all');
    const [tracked, setTracked] = useState([]);
    const [pickJid, setPickJid] = useState('');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/whatsapp-monitor/settings')
            .then(({ data }) => { setMode(data.mode); setTracked(data.tracked || []); })
            .catch(() => setError('שגיאה בטעינת ההגדרות'));
        // כל השיחות (גם במצב 'selected') — כדי שאפשר יהיה לבחור אדם אחר
        api.get('/whatsapp-monitor/chats', { params: { all: '1' } })
            .then(({ data }) => setChats(data))
            .catch(() => {});
    }, []);

    const addFromChat = () => {
        const c = chats.find((x) => x.jid === pickJid);
        if (!c) return;
        setTracked((t) => [...t.filter((x) => x.jid !== c.jid), { jid: c.jid, phone: c.phone || '', name: chatTitle(c) }]);
        setPickJid('');
    };
    const addByPhone = () => {
        if (!phone.replace(/\D/g, '')) return;
        setTracked((t) => [...t, { jid: '', phone, name }]);
        setPhone(''); setName('');
    };

    const save = async () => {
        setSaving(true); setError('');
        try {
            await api.put('/whatsapp-monitor/settings', { mode, tracked });
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div dir="rtl" className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> הגדרות מעקב</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 space-y-5">
                    <section>
                        <h4 className="font-semibold mb-1">איש הקשר במעקב</h4>
                        <p className="text-xs text-gray-500 mb-2">
                            השיחה שלו מוצגת בעמוד הצופה <code>/wa-view</code> וב-API <code>/api/wa-view/messages</code>.
                        </p>
                        {tracked.length === 0 && <div className="text-sm text-gray-400 mb-2">לא נבחר איש קשר</div>}
                        <ul className="space-y-1 mb-3">
                            {tracked.map((t, i) => (
                                <li key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                                    <span>{t.name || 'ללא שם'} <span className="text-gray-500" dir="ltr">{t.phone ? `+${t.phone.replace(/\D/g, '')}` : t.jid}</span></span>
                                    <button onClick={() => setTracked(tracked.filter((_, j) => j !== i))} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="flex gap-2 mb-2">
                            <select value={pickJid} onChange={(e) => setPickJid(e.target.value)}
                                className="flex-1 border rounded px-2 py-1.5 text-sm bg-white">
                                <option value="">בחר משיחה קיימת…</option>
                                {chats.map((c) => <option key={c.jid} value={c.jid}>{chatTitle(c)}{c.phone ? ` (+${c.phone})` : ''}</option>)}
                            </select>
                            <button onClick={addFromChat} disabled={!pickJid} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-40">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="או מספר: 050-1234567"
                                className="flex-1 border rounded px-2 py-1.5 text-sm" dir="ltr" />
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם (לא חובה)"
                                className="w-32 border rounded px-2 py-1.5 text-sm" />
                            <button onClick={addByPhone} disabled={!phone} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-40">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </section>

                    <section>
                        <h4 className="font-semibold mb-2">מה לשמור</h4>
                        <label className="flex items-start gap-2 text-sm mb-2 cursor-pointer">
                            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} className="mt-1" />
                            <span>את כל השיחות האישיות</span>
                        </label>
                        <label className="flex items-start gap-2 text-sm cursor-pointer">
                            <input type="radio" checked={mode === 'selected'} onChange={() => setMode('selected')} className="mt-1" />
                            <span>רק את איש הקשר שבמעקב<br />
                                <span className="text-xs text-gray-500">הודעות של אנשים אחרים לא יישמרו מעכשיו. מה שכבר נשמר נשאר ב-DB אבל מוסתר מהרשימה.</span>
                            </span>
                        </label>
                    </section>

                    {error && <div className="text-sm text-red-600">{error}</div>}
                </div>

                <div className="flex gap-2 justify-end p-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 rounded border text-sm">ביטול</button>
                    <button onClick={save} disabled={saving || (mode === 'selected' && !tracked.length)}
                        className="px-4 py-2 rounded bg-[#008069] text-white text-sm font-semibold disabled:opacity-50">
                        {saving ? 'שומר…' : 'שמירה'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// ===  MAIN PAGE  ===
// ============================================================
export default function WhatsAppMonitorPage() {
    const [status, setStatus] = useState('disconnected');
    const [qr, setQr] = useState(null);
    const [chats, setChats] = useState([]);
    const [activeJid, setActiveJid] = useState(null);
    const [messages, setMessages] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [search, setSearch] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [fetchingIds, setFetchingIds] = useState(() => new Set());
    const scrollRef = useRef(null);
    const activeJidRef = useRef(null);
    const messagesRef = useRef([]);
    const stickToBottom = useRef(true);

    useEffect(() => { activeJidRef.current = activeJid; }, [activeJid]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // ── סטטוס + QR ──
    const refreshStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/whatsapp-monitor/qr');
            setStatus(data.state);
            setQr(data.qr);
            return data.state;
        } catch (err) {
            setStatus('disconnected');
            return 'disconnected';
        }
    }, []);

    const loadChats = useCallback(async () => {
        try {
            const { data } = await api.get('/whatsapp-monitor/chats');
            setChats(data);
            return data;
        } catch (_) { return null; }
    }, []);

    const loadMessages = useCallback(async (jid) => {
        setLoadingMsgs(true);
        stickToBottom.current = true;
        try {
            const { data } = await api.get(`/whatsapp-monitor/chats/${encodeURIComponent(jid)}/messages`, { params: { limit: 100 } });
            if (activeJidRef.current !== jid) return;
            setMessages(data.messages);
            setHasMore(data.hasMore);
        } catch (_) {
            setMessages([]);
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    /** fallback אם הסוקט לא מעביר הודעות — מושך רק מה שחדש מאז ההודעה האחרונה */
    const pullNewForActive = useCallback(async () => {
        const jid = activeJidRef.current;
        const last = messagesRef.current[messagesRef.current.length - 1];
        if (!jid || !last) return;
        try {
            const { data } = await api.get(`/whatsapp-monitor/chats/${encodeURIComponent(jid)}/messages`, { params: { after: last.timestamp } });
            if (activeJidRef.current === jid && data.messages.length) {
                setMessages((prev) => mergeMessages(prev, data.messages));
            }
        } catch (_) { /* ignore */ }
    }, []);

    // אתחול + polling (סטטוס, רשימת צ'אטים, השיחה הפתוחה)
    useEffect(() => {
        const tick = async () => {
            const state = await refreshStatus();
            if (state !== 'connected') return;
            const list = await loadChats();
            const jid = activeJidRef.current;
            const chat = list?.find((c) => c.jid === jid);
            const last = messagesRef.current[messagesRef.current.length - 1];
            if (chat && last && new Date(chat.lastMessageAt) > new Date(last.timestamp)) pullNewForActive();
        };
        tick();
        const interval = setInterval(tick, POLL_MS);
        return () => clearInterval(interval);
    }, [refreshStatus, loadChats, pullNewForActive]);

    // גלילה לתחתית כשמגיעות הודעות (אם המשתמש כבר למטה)
    useEffect(() => {
        const el = scrollRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [messages]);

    // ── Socket live ──
    useEffect(() => {
        let socket = getSocket();
        if (!socket) socket = connectSocket();
        if (!socket) return;

        const onMessage = (payload) => {
            if (payload.chatJid === activeJidRef.current) {
                setMessages((prev) => mergeMessages(prev, [payload]));
                api.post(`/whatsapp-monitor/chats/${encodeURIComponent(payload.chatJid)}/read`).catch(() => {});
            }
            loadChats();
        };
        const onUpdate = ({ messageId, chatJid, patch }) => {
            if (chatJid !== activeJidRef.current) return;
            setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, ...patch } : m)));
        };
        const onStatus = (s) => {
            setStatus(s.state);
            if (s.state === 'connected') loadChats();
        };

        socket.on('wa-monitor:message', onMessage);
        socket.on('wa-monitor:update', onUpdate);
        socket.on('wa-monitor:status', onStatus);
        return () => {
            socket.off('wa-monitor:message', onMessage);
            socket.off('wa-monitor:update', onUpdate);
            socket.off('wa-monitor:status', onStatus);
        };
    }, [loadChats]);

    const handleConnect = async () => {
        try { await api.post('/whatsapp-monitor/connect'); } catch (_) { /* ignore */ }
        refreshStatus();
    };

    const handleLogout = async () => {
        if (!window.confirm('לנתק את חיבור הוואצפ? יידרש QR חדש בחיבור הבא.')) return;
        try { await api.post('/whatsapp-monitor/logout'); } catch (_) { /* ignore */ }
        setStatus('disconnected');
        setChats([]);
        setMessages([]);
        setActiveJid(null);
    };

    const openChat = (jid) => {
        setActiveJid(jid);
        activeJidRef.current = jid;
        setMessages([]);
        loadMessages(jid);
        setChats((cs) => cs.map((c) => (c.jid === jid ? { ...c, unreadCount: 0 } : c)));
        api.post(`/whatsapp-monitor/chats/${encodeURIComponent(jid)}/read`).catch(() => {});
    };

    const loadOlder = async () => {
        const jid = activeJidRef.current;
        if (!jid || !messages.length) return;
        const el = scrollRef.current;
        const prevHeight = el?.scrollHeight || 0;
        try {
            const { data } = await api.get(`/whatsapp-monitor/chats/${encodeURIComponent(jid)}/messages`, {
                params: { before: messages[0].timestamp, limit: 100 },
            });
            stickToBottom.current = false;
            setMessages((prev) => mergeMessages(prev, data.messages));
            setHasMore(data.hasMore);
            requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
        } catch (_) { /* ignore */ }
    };

    const fetchMedia = async (messageId) => {
        setFetchingIds((s) => new Set(s).add(messageId));
        try {
            const { data } = await api.post(`/whatsapp-monitor/media/${encodeURIComponent(messageId)}/fetch`);
            setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, mediaPath: data.mediaPath, mediaUnavailable: false } : m)));
        } catch (err) {
            window.alert(err.response?.data?.message || 'ההורדה נכשלה');
        } finally {
            setFetchingIds((s) => { const n = new Set(s); n.delete(messageId); return n; });
        }
    };

    const onScroll = () => {
        const el = scrollRef.current;
        if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    const filteredChats = chats.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return chatTitle(c).toLowerCase().includes(q) || (c.phone || '').includes(q.replace(/\D/g, '') || '§');
    });

    const activeChat = chats.find((c) => c.jid === activeJid);

    // ── מסך לא-מחובר ──
    if (status !== 'connected') {
        return (
            <div className="h-[calc(100vh-4rem)] md:h-screen bg-gray-100">
                <ConnectPanel status={status} qr={qr} onRefresh={refreshStatus} onConnect={handleConnect} />
            </div>
        );
    }

    // הודעות + מפרידי יום
    const rows = [];
    let prevDay = null;
    for (const m of messages) {
        const day = new Date(m.timestamp).toDateString();
        if (day !== prevDay) { rows.push({ day: true, key: `d-${day}`, ts: m.timestamp }); prevDay = day; }
        rows.push({ key: m.messageId, m });
    }

    return (
        <div dir="rtl" className="h-[calc(100vh-4rem)] md:h-screen flex bg-[#efeae2] overflow-hidden">
            {/* ── רשימת צ'אטים ── */}
            <aside className={`w-full md:w-[340px] bg-white border-l flex flex-col ${activeJid ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-3 bg-[#008069] text-white flex items-center justify-between">
                    <span className="font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5" /> מעקב וואצפ</span>
                    <div className="flex items-center gap-1">
                        <Link to="/wa-view" title="עמוד הצופה" className="hover:bg-white/20 p-1.5 rounded"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => setShowSettings(true)} title="הגדרות מעקב" className="hover:bg-white/20 p-1.5 rounded">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={handleLogout} title="ניתוק" className="hover:bg-white/20 p-1.5 rounded">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-2 border-b">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="חיפוש או מספר" className="bg-transparent flex-1 text-sm outline-none" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredChats.length === 0 && (
                        <div className="text-center text-gray-400 text-sm p-6">אין שיחות עדיין</div>
                    )}
                    {filteredChats.map((c) => (
                        <button key={c.jid} onClick={() => openChat(c.jid)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 border-b hover:bg-gray-50 text-right
                                ${activeJid === c.jid ? 'bg-gray-100' : ''}`}>
                            <div className="w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold shrink-0">
                                {initialOf(c)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                    <span className="font-semibold text-gray-900 truncate">{chatTitle(c)}</span>
                                    <span className={`text-[11px] shrink-0 ${c.unreadCount ? 'text-[#00a884] font-semibold' : 'text-gray-400'}`}>{fmtChatTime(c.lastMessageAt)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-xs text-gray-500 truncate">
                                        {c.lastFromMe ? 'אני: ' : ''}{c.lastMessageText}
                                    </span>
                                    {c.unreadCount > 0 && (
                                        <span className="bg-[#25d366] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
                                            {c.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── שיחה ── */}
            <main className={`flex-1 flex flex-col min-w-0 ${activeJid ? 'flex' : 'hidden md:flex'}`}>
                {!activeJid ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        בחר שיחה כדי לצפות בהתכתבות
                    </div>
                ) : (
                    <>
                        <header className="p-3 bg-[#f0f2f5] border-b flex items-center gap-3">
                            <button onClick={() => setActiveJid(null)} className="md:hidden p-1">
                                <ArrowRight className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold">
                                {initialOf(activeChat)}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{chatTitle(activeChat)}</div>
                                <div className="text-xs text-gray-500" dir="ltr">{activeChat?.phone ? `+${activeChat.phone}` : activeChat?.jid}</div>
                            </div>
                        </header>

                        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loadingMsgs ? (
                                <div className="flex justify-center py-10 text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">אין הודעות בשיחה זו</div>
                            ) : (
                                <>
                                    {hasMore && (
                                        <div className="flex justify-center">
                                            <button onClick={loadOlder} className="text-xs bg-white/80 rounded-full px-3 py-1 shadow text-gray-700 hover:bg-white">
                                                הצג הודעות קודמות
                                            </button>
                                        </div>
                                    )}
                                    {rows.map((r) => r.day ? (
                                        <div key={r.key} className="flex justify-center py-1">
                                            <span className="bg-white/90 text-gray-600 text-xs rounded-lg px-3 py-1 shadow-sm">{fmtDay(r.ts)}</span>
                                        </div>
                                    ) : (
                                        <WaMessageBubble key={r.key} msg={toBubbleMessage(r.m)} contactLabel={chatTitle(activeChat)}
                                            onFetchMedia={fetchMedia} fetching={fetchingIds.has(r.m.messageId)} />
                                    ))}
                                </>
                            )}
                        </div>
                    </>
                )}
            </main>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={loadChats} />}
        </div>
    );
}
