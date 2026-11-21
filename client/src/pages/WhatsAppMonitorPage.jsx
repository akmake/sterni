import React, { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/utils/api';
import { getSocket, connectSocket } from '@/utils/socket';
import {
    MessageCircle, Search, RefreshCw, LogOut, ArrowRight,
    FileText, Mic, Image as ImageIcon, Video as VideoIcon, Loader2,
} from 'lucide-react';

const MEDIA_URL = (messageId) => `/api/whatsapp-monitor/media/${messageId}`;

const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const fmtChatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(ts);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
};

const initialOf = (name, phone) => {
    const base = (name || phone || '?').trim();
    return base.charAt(0).toUpperCase();
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
// ===  MEDIA BUBBLE  ===
// ============================================================
function MediaContent({ msg }) {
    if (msg.mediaUnavailable || (!msg.mediaPath && msg.type !== 'text')) {
        const label = { image: 'תמונה', video: 'סרטון', audio: 'הודעה קולית', document: 'קובץ', sticker: 'מדבקה' }[msg.type] || 'מדיה';
        return (
            <div className="flex items-center gap-2 text-gray-400 italic text-sm py-1">
                {msg.type === 'audio' ? <Mic className="w-4 h-4" /> :
                 msg.type === 'video' ? <VideoIcon className="w-4 h-4" /> :
                 msg.type === 'document' ? <FileText className="w-4 h-4" /> :
                 <ImageIcon className="w-4 h-4" />}
                [{label} לא זמינ/ה]
            </div>
        );
    }

    const url = MEDIA_URL(msg.messageId);
    if (msg.type === 'image' || msg.type === 'sticker') {
        return (
            <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="rounded-lg max-w-[240px] max-h-[320px] object-cover" />
            </a>
        );
    }
    if (msg.type === 'video') {
        return <video controls className="rounded-lg max-w-[240px]" src={url} />;
    }
    if (msg.type === 'audio') {
        return <audio controls className="max-w-[240px]" src={url} />;
    }
    if (msg.type === 'document') {
        return (
            <a href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline">
                <FileText className="w-5 h-5" />
                {msg.fileName || 'קובץ מצורף'}
            </a>
        );
    }
    return null;
}

// ============================================================
// ===  MESSAGE BUBBLE  ===
// ============================================================
function Bubble({ msg }) {
    const mine = msg.fromMe;
    return (
        <div className={`w-full flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div dir="rtl" className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm text-right
                ${mine ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
                {msg.quotedText && (
                    <div className="border-r-4 border-green-500 bg-black/5 rounded px-2 py-1 mb-1 text-xs text-gray-600 truncate">
                        {msg.quotedText}
                    </div>
                )}
                {['image', 'video', 'audio', 'document', 'sticker'].includes(msg.type) && (
                    <div className="mb-1"><MediaContent msg={msg} /></div>
                )}
                {msg.text && <div className="whitespace-pre-wrap break-words text-sm text-gray-900">{msg.text}</div>}
                <div className="text-[10px] text-gray-400 mt-1 text-left">{fmtTime(msg.timestamp)}</div>
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
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [search, setSearch] = useState('');
    const scrollRef = useRef(null);
    const activeJidRef = useRef(null);

    useEffect(() => { activeJidRef.current = activeJid; }, [activeJid]);

    // ── סטטוס + QR (polling כשלא מחובר) ──
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
        } catch (_) { /* ignore */ }
    }, []);

    const loadMessages = useCallback(async (jid) => {
        setLoadingMsgs(true);
        try {
            const { data } = await api.get(`/whatsapp-monitor/chats/${encodeURIComponent(jid)}/messages`);
            setMessages(data.messages);
        } catch (_) {
            setMessages([]);
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    // אתחול + polling סטטוס
    useEffect(() => {
        let interval;
        (async () => {
            const state = await refreshStatus();
            if (state === 'connected') loadChats();
        })();
        interval = setInterval(async () => {
            const state = await refreshStatus();
            if (state === 'connected') { loadChats(); }
        }, 4000);
        return () => clearInterval(interval);
    }, [refreshStatus, loadChats]);

    // גלילה לתחתית כשההודעות משתנות
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    // ── Socket live ──
    useEffect(() => {
        let socket = getSocket();
        if (!socket) socket = connectSocket();
        if (!socket) return;

        const onMessage = (payload) => {
            // עדכון השיחה הפתוחה
            if (payload.chatJid === activeJidRef.current) {
                setMessages((prev) => {
                    if (prev.some((m) => m.messageId === payload.messageId)) return prev;
                    return [...prev, payload];
                });
            }
            // עדכון רשימת הצ'אטים
            loadChats();
        };
        const onStatus = (s) => {
            setStatus(s.state);
            if (s.state === 'connected') loadChats();
        };

        socket.on('wa-monitor:message', onMessage);
        socket.on('wa-monitor:status', onStatus);
        return () => {
            socket.off('wa-monitor:message', onMessage);
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
        loadMessages(jid);
    };

    const filteredChats = chats.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
    });

    const activeChat = chats.find((c) => c.jid === activeJid);

    // ── מסך לא-מחובר ──
    if (status !== 'connected') {
        return (
            <div className="h-[calc(100vh-4rem)] bg-gray-100">
                <ConnectPanel status={status} qr={qr} onRefresh={refreshStatus} onConnect={handleConnect} />
            </div>
        );
    }

    return (
        <div dir="rtl" className="h-[calc(100vh-4rem)] flex bg-[#efeae2] overflow-hidden">
            {/* ── רשימת צ'אטים ── */}
            <aside className={`w-full md:w-[340px] bg-white border-l flex flex-col ${activeJid ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-3 bg-[#008069] text-white flex items-center justify-between">
                    <span className="font-bold flex items-center gap-2"><MessageCircle className="w-5 h-5" /> מעקב וואצפ</span>
                    <button onClick={handleLogout} title="ניתוק" className="hover:bg-white/20 p-1.5 rounded">
                        <LogOut className="w-4 h-4" />
                    </button>
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
                                {initialOf(c.name, c.phone)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                    <span className="font-semibold text-gray-900 truncate">{c.name || c.phone}</span>
                                    <span className="text-[11px] text-gray-400 shrink-0">{fmtChatTime(c.lastMessageAt)}</span>
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {c.lastFromMe ? 'את/ה: ' : ''}{c.lastMessageText}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── שיחה ── */}
            <main className={`flex-1 flex flex-col ${activeJid ? 'flex' : 'hidden md:flex'}`}>
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
                                {initialOf(activeChat?.name, activeChat?.phone)}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{activeChat?.name || activeChat?.phone}</div>
                                <div className="text-xs text-gray-500">{activeChat?.phone}</div>
                            </div>
                        </header>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2"
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3C/svg%3E")' }}>
                            {loadingMsgs ? (
                                <div className="flex justify-center py-10 text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">אין הודעות בשיחה זו</div>
                            ) : (
                                messages.map((m) => <Bubble key={m.messageId} msg={m} />)
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
