import React from 'react';
import { FileText, Mic, Music, Image as ImageIcon, Video as VideoIcon, Download, MapPin, User, BarChart3, Ban, Pencil, Loader2 } from 'lucide-react';

/**
 * WaMessageBubble — בועת הודעת וואצפ אחת. משותף ל:
 *   - client/src/pages/WhatsAppMonitorPage.jsx (פאנל אדמין)
 *   - client/src/pages/WaViewerPage.jsx       (עמוד צופה)
 *
 * מקבל הודעה בצורה המנורמלת של GET /api/wa-view/messages:
 *   { id, direction:'in'|'out', timestamp, type, text, quotedText,
 *     media:{available,url,downloadUrl,mime,fileName,fileSize,durationSeconds,isVoiceNote}|null,
 *     location, contact, poll, deleted, edited, originalText, reactions:[{emoji,by}] }
 * הפאנל ממיר את מסמך ה-DB לצורה הזו עם toBubbleMessage (למטה).
 */

export const fmtDateTime = (ts) =>
    new Date(ts).toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

export const fmtDay = (ts) =>
    new Date(ts).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDuration = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** ממיר מסמך WhatsAppMessage (מ-/api/whatsapp-monitor) לצורה של הבועה */
export const toBubbleMessage = (m) => {
    const isMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(m.type);
    const base = `/api/whatsapp-monitor/media/${encodeURIComponent(m.messageId)}`;
    return {
        id: m.messageId,
        direction: m.fromMe ? 'out' : 'in',
        timestamp: m.timestamp,
        type: m.type,
        text: m.text || '',
        quotedText: m.quotedText || null,
        media: isMedia ? {
            available: !!m.mediaPath && !m.mediaUnavailable,
            url: base,
            downloadUrl: `${base}?download=1`,
            mime: m.mediaMime || '',
            fileName: m.fileName || '',
            fileSize: m.fileSize || 0,
            durationSeconds: m.durationSeconds || 0,
            isVoiceNote: !!m.isVoiceNote,
        } : null,
        location: m.location,
        contact: m.contactCard,
        poll: m.poll,
        deleted: !!m.deleted,
        edited: !!m.edited,
        originalText: m.originalText,
        reactions: (m.reactions || []).map((r) => ({ emoji: r.emoji, by: r.fromMe ? 'me' : 'them' })),
    };
};

const DownloadLink = ({ href, label = 'הורדה' }) => (
    <a href={href} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Download className="w-3.5 h-3.5" /> {label}
    </a>
);

/**
 * @param {function} [onFetchMedia]  אם קיים — כפתור "הורד מוואצפ" כשהקובץ לא בשרת (פאנל אדמין).
 *                                   בלעדיו — הקישורים עצמם מנסים להוריד בצד השרת (עמוד צופה).
 */
function Media({ msg, onFetchMedia, fetching }) {
    const { media, type } = msg;
    const label = {
        image: 'תמונה', video: 'סרטון', document: 'קובץ', sticker: 'מדבקה',
        audio: media.isVoiceNote ? 'הקלטה' : 'קובץ שמע',
    }[type] || 'מדיה';
    const Icon = { image: ImageIcon, video: VideoIcon, document: FileText, sticker: ImageIcon, audio: media.isVoiceNote ? Mic : Music }[type] || FileText;
    const meta = [fmtDuration(media.durationSeconds), fmtSize(media.fileSize)].filter(Boolean).join(' · ');

    if (!media.available && onFetchMedia) {
        return (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-1">
                <Icon className="w-4 h-4" />
                <span>{label}{media.fileName ? `: ${media.fileName}` : ''}{meta ? ` (${meta})` : ''} — לא נשמר בשרת</span>
                <button onClick={() => onFetchMedia(msg.id)} disabled={fetching}
                    className="text-xs text-green-700 hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                    {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} הורד מוואצפ
                </button>
            </div>
        );
    }

    if ((type === 'image' || type === 'sticker') && media.available) {
        return (
            <div className="space-y-1">
                <a href={media.url} target="_blank" rel="noreferrer">
                    <img src={media.url} alt="" loading="lazy" className="rounded-lg max-w-[260px] max-h-[320px] object-cover" />
                </a>
                <DownloadLink href={media.downloadUrl} />
            </div>
        );
    }
    if (type === 'video' && media.available) {
        return (
            <div className="space-y-1">
                <video controls preload="metadata" className="rounded-lg max-w-[260px]" src={media.url} />
                <DownloadLink href={media.downloadUrl} />
            </div>
        );
    }
    if (type === 'audio') {
        return (
            <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Icon className="w-3.5 h-3.5" /> {label}{meta ? ` · ${meta}` : ''}
                </div>
                <audio controls preload="none" className="max-w-[260px]" src={media.url} />
                <DownloadLink href={media.downloadUrl} label="הורדת קובץ השמע" />
            </div>
        );
    }
    // מסמך / מדיה שעוד לא בשרת (בעמוד הצופה הקישור מוריד בצד השרת)
    return (
        <div className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
            <Icon className="w-6 h-6 text-gray-500 shrink-0" />
            <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{media.fileName || label}</div>
                {meta && <div className="text-xs text-gray-500">{meta}</div>}
                <div className="flex gap-3 mt-0.5">
                    <a href={media.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">פתיחה</a>
                    <DownloadLink href={media.downloadUrl} />
                </div>
            </div>
        </div>
    );
}

function Special({ msg }) {
    if (msg.type === 'location' && msg.location) {
        const { lat, lng, name, address } = msg.location;
        return (
            <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
                <MapPin className="w-4 h-4" /> {name || address || `${lat?.toFixed?.(5)}, ${lng?.toFixed?.(5)}`}
            </a>
        );
    }
    if (msg.type === 'contact' && msg.contact) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-800">
                <User className="w-4 h-4" /> {msg.contact.name}{msg.contact.phone ? ` — ${msg.contact.phone}` : ''}
            </div>
        );
    }
    if (msg.type === 'poll' && msg.poll) {
        return (
            <div className="text-sm text-gray-800">
                <div className="flex items-center gap-1 font-semibold"><BarChart3 className="w-4 h-4" /> {msg.poll.name}</div>
                <ul className="list-disc pr-5 mt-1">{(msg.poll.options || []).map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
        );
    }
    return null;
}

export default function WaMessageBubble({ msg, showId = false, isNew = false, onFetchMedia, fetching = false, contactLabel }) {
    const mine = msg.direction === 'out';
    return (
        <div className={`w-full flex ${mine ? 'justify-end' : 'justify-start'}`} data-message-id={msg.id}>
            <div dir="rtl" className={`relative max-w-[80%] md:max-w-[65%] rounded-lg px-3 py-2 shadow-sm text-right
                ${mine ? 'bg-[#d9fdd3]' : 'bg-white'} ${isNew ? 'ring-2 ring-amber-400' : ''}`}>
                <div className="flex items-center gap-2 mb-0.5 text-[11px] font-semibold">
                    <span className={mine ? 'text-emerald-700' : 'text-sky-700'}>{mine ? 'אני' : (contactLabel || 'איש הקשר')}</span>
                    {isNew && <span className="bg-amber-400 text-white rounded px-1.5 py-px text-[10px]">חדש</span>}
                </div>

                {msg.quotedText && (
                    <div className="border-r-4 border-green-500 bg-black/5 rounded px-2 py-1 mb-1 text-xs text-gray-600 line-clamp-3">
                        {msg.quotedText}
                    </div>
                )}

                {msg.media && <div className="mb-1"><Media msg={msg} onFetchMedia={onFetchMedia} fetching={fetching} /></div>}
                <Special msg={msg} />

                {msg.text && (
                    <div className={`whitespace-pre-wrap break-words text-sm text-gray-900 ${msg.deleted ? 'opacity-70' : ''}`}>{msg.text}</div>
                )}
                {msg.edited && msg.originalText != null && msg.originalText !== msg.text && (
                    <div className="mt-1 text-xs text-gray-500 border-t border-black/10 pt-1">
                        <span className="font-semibold">לפני העריכה:</span> {msg.originalText}
                    </div>
                )}

                {(msg.reactions || []).length > 0 && (
                    <div className="mt-1 flex gap-1">
                        {msg.reactions.map((r, i) => (
                            <span key={i} title={r.by === 'me' ? 'אני' : 'איש הקשר'} className="bg-white border rounded-full px-1.5 text-sm">{r.emoji}</span>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 mt-1 text-[10px] text-gray-500">
                    <span className="flex items-center gap-2">
                        {msg.deleted && <span className="inline-flex items-center gap-0.5 text-red-600"><Ban className="w-3 h-3" /> נמחקה ע״י השולח</span>}
                        {msg.edited && <span className="inline-flex items-center gap-0.5"><Pencil className="w-3 h-3" /> נערכה</span>}
                    </span>
                    <span dir="ltr">{fmtDateTime(msg.timestamp)}</span>
                </div>
                {showId && (
                    <div dir="ltr" className="mt-0.5 text-[10px] text-gray-400 font-mono select-all text-left" title="מזהה הודעה">
                        #{msg.id}
                    </div>
                )}
            </div>
        </div>
    );
}
