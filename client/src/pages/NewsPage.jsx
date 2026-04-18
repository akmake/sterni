import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

/* ── helpers ── */
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע'`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
}

const CHANNEL_META = {
  amitsegal: { label: 'עמית סגל', color: 'from-sky-400 to-sky-600', shadow: 'shadow-sky-500/20' },
  rotter:    { label: 'רוטר',     color: 'from-orange-400 to-red-500', shadow: 'shadow-orange-500/20' },
  grinzaig:  { label: 'אבישי גרינצייג', color: 'from-purple-400 to-purple-600', shadow: 'shadow-purple-500/20' },
  alexmehacarmel: { label: 'אלכס מהכרמל', color: 'from-indigo-400 to-blue-600', shadow: 'shadow-indigo-500/20' },
  abualiexpress: { label: 'אבו עלי אקספרס', color: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/20' },
};

/* ── Lightbox ── */
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out transition-all duration-500" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-6 left-6 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center text-white transition-all duration-300 hover:scale-105 hover:rotate-90">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* ── Article Content ── */
function YoutubeEmbed({ videoId }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-4 border border-slate-100 shadow-sm group" style={{ paddingTop: '56.25%' }}>
      <div className="absolute inset-0 bg-slate-100 animate-pulse group-hover:hidden" />
      <iframe
        className="absolute inset-0 w-full h-full z-10"
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );
}

function ArticleContent({ url, title }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.get(`/news/article?url=${encodeURIComponent(url)}`)
      .then(({ data }) => { if (!cancelled) setContent(data.content || data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return (
    <div className="mt-5 space-y-3 animate-pulse">
      <div className="h-4 bg-slate-100 rounded-md w-full" />
      <div className="h-4 bg-slate-100 rounded-md w-11/12" />
      <div className="h-4 bg-slate-100 rounded-md w-4/6" />
      <div className="h-40 bg-slate-50 rounded-2xl mt-4 border border-slate-100" />
    </div>
  );

  if (error || !content?.text) return (
    <div className="mt-5 text-center p-6 bg-red-50 border border-red-100 rounded-2xl">
      <p className="text-sm text-red-600 mb-3">התרחשה שגיאה בטעינת תוכן הכתבה</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-sm text-red-500 hover:text-red-700 underline decoration-red-200 underline-offset-4 transition-colors">
        מעבר לכתבה המקורית ברוטר ↗
      </a>
    </div>
  );

  return (
    <div className="mt-6 pt-5 space-y-5 relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-slate-200 before:to-transparent">
      {/* YouTube embeds */}
      {content.youtubeEmbeds?.map((embed, i) =>
        embed.videoId ? <YoutubeEmbed key={i} videoId={embed.videoId} /> : null
      )}

      {/* תמונות */}
      <div className="space-y-4">
        {content.images?.map((src, i) => (
          <img key={i} src={src} alt="" className="w-full rounded-2xl object-cover border border-slate-100 shadow-sm bg-slate-50"
            style={{ maxHeight: '450px' }} onError={(e) => e.target.style.display = 'none'} />
        ))}
      </div>

      {/* טקסט גוף הכתבה */}
      {content.text && (
        <div className="prose prose-sm sm:prose-base max-w-none text-slate-700 leading-relaxed tracking-wide whitespace-pre-line font-medium">
          {content.text}
        </div>
      )}

      {/* תגובות */}
      {content.comments?.length > 0 && (
        <div className="mt-6 pt-5 relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-slate-200 before:to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">תגובות נבחרות</h4>
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">{content.comments.length}</span>
          </div>
          <div className="space-y-3">
            {content.comments.map((c, i) => (
              <div key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-white transition-colors shadow-sm">
                <span className="text-slate-400 font-mono text-xs mt-1 select-none w-5 text-left">{i + 1}.</span>
                <p className="flex-1">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mt-4 py-2 px-3 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200">
        <span>לקריאה במקור: רוטר.נט</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
      </a>
    </div>
  );
}

/* ── VideoPlayer ── */
function VideoPlayer({ src, thumb }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <video src={src} controls autoPlay className="w-full rounded-2xl mb-4 bg-black border border-slate-200 shadow-md" style={{ maxHeight: '500px' }} />;
  }

  return (
    <div className="relative mb-4 rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-slate-100 bg-slate-50" onClick={() => setPlaying(true)}>
      {thumb
        ? <img src={thumb} alt="" className="w-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" style={{ maxHeight: '450px' }} />
        : <div className="w-full h-64 bg-slate-100" />
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur-md border border-white/80 flex items-center justify-center group-hover:scale-110 group-hover:border-white group-hover:bg-white/80 transition-all duration-300 shadow-lg group-hover:shadow-xl">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-slate-800 ml-1"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
        </div>
      </div>
    </div>
  );
}

/* ── FeedCard ── */
function FeedCard({ item, onImageClick, itemIds }) {
  const [expanded, setExpanded] = useState(false);
  const sourceKey = item.source === 'rotter' ? 'rotter' : item.channel;
  const meta = CHANNEL_META[sourceKey] || { label: sourceKey, color: 'from-slate-400 to-slate-600', shadow: 'shadow-slate-300/30' };
  const isRecent = (Date.now() - new Date(item.date)) < 1800_000; // < 30 mins

  function handleReplyClick(e) {
    if (!item.replyLink) return;
    const match = item.replyLink.match(/t\.me\/([^/]+)\/(\d+)/);
    if (match) {
      const targetId = `${match[1]}-${match[2]}`;
      if (itemIds.has(targetId)) {
        e.preventDefault();
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  return (
    <article id={item.id} className="relative bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 overflow-hidden border border-slate-100 scroll-mt-28 group">
      
      <div className="p-5 sm:p-7 relative z-10">
        {/* meta row */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center flex-shrink-0 shadow-sm ${meta.shadow}`}>
            <span className="text-white text-sm font-black tracking-tighter">{meta.label[0]}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 tracking-wide">{meta.label}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isRecent && <span className="relative flex h-2 w-2 shadow-[0_0_8px_rgba(34,197,94,0.4)] rounded-full">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>}
              <span className={`text-[11px] font-semibold tracking-wider ${isRecent ? 'text-green-600' : 'text-slate-400'}`}>{timeAgo(item.date)}</span>
            </div>
          </div>
          
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="mr-auto w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all duration-300 group/btn" title="צפייה במקור">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </a>
        </div>

        {/* Forwarded from */}
        {item.forwardedFrom && (
          <a href={item.forwardedFrom.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
            <span>הועבר מ <span className="text-slate-700">{item.forwardedFrom.name}</span></span>
          </a>
        )}

        {/* ציטוט / תגובה ל */}
        {item.replyText && (
          <a href={item.replyLink || item.link} target="_blank" rel="noopener noreferrer"
            className="flex gap-3 mb-5 group/reply cursor-pointer bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm" onClick={handleReplyClick}>
            <div className="w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full flex-shrink-0 opacity-70 group-hover/reply:opacity-100 transition-opacity" />
            <p className="text-sm text-slate-600 group-hover/reply:text-slate-900 leading-relaxed line-clamp-2 transition-colors font-medium">{item.replyText}</p>
          </a>
        )}

        {/* טקסט - טלגרם */}
        {item.text && <p className="text-slate-800 text-sm sm:text-[15px] leading-relaxed whitespace-pre-line mb-5 font-medium tracking-wide">{item.text}</p>}

        {/* תמונה בתוך הקארד */}
        {item.image && !item.video && (
          <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50 group/img cursor-zoom-in mb-5" onClick={() => onImageClick(item.image)}>
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors z-10" />
            <img src={item.image} alt="" className="w-full object-cover transition-transform duration-700 group-hover/img:scale-[1.02]"
              style={{ maxHeight: '500px' }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        )}

        {/* וידאו - טלגרם */}
        {item.video && <VideoPlayer src={item.video} thumb={item.videoThumb} />}

        {/* כותרת רוטר + expand */}
        {item.title && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center justify-between w-full text-right group/expand mt-3"
          >
            <span className="text-slate-900 text-base sm:text-[17px] font-bold leading-snug group-hover/expand:text-blue-600 transition-colors text-balance">
              {item.title}
            </span>
            <div className={`ml-3 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 flex-shrink-0 transition-all duration-300 shadow-sm ${expanded ? 'rotate-180 bg-slate-100 border-slate-300' : 'group-hover/expand:bg-blue-50 group-hover/expand:border-blue-200 group-hover/expand:text-blue-500'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 ${expanded ? 'text-slate-600' : 'text-slate-400 group-hover/expand:text-blue-500'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </div>
          </button>
        )}

        {/* תוכן הכתבה - מוצג בלחיצה */}
        {expanded && item.source === 'rotter' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <ArticleContent url={item.link} title={item.title} />
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Header ── */
function FeedHeader({ count, lastUpdated, loading, onRefresh }) {
  return (
    <div className="mb-10 relative z-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-5">
        <div>
          <h1 className="text-3xl sm:text-[40px] font-black text-slate-900 tracking-tight">פיד חדשות</h1>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-500 mt-3">
            {count > 0 && <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">{count} פריטים</span>}
            {lastUpdated && (<>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 rounded-full bg-green-500"></span>
                עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>)}
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="group relative flex items-center justify-center gap-2 px-6 py-2.5 overflow-hidden rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:text-slate-900 hover:border-slate-300 disabled:opacity-50 transition-all duration-300 shadow-sm hover:shadow active:scale-95">
          <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 relative z-10 transition-transform duration-500 text-slate-500 group-hover:text-slate-800 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
          <span className="relative z-10 tracking-wide">{loading ? 'מרענן...' : 'רענון עצמי'}</span>
        </button>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function NewsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const itemIds = new Set(items.map(x => x.id));

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/news/feed');
      setItems(data.items);
      setLastUpdated(new Date());
    } catch {
      setError('אירעה שגיאה בטעינת הנתונים.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-100 font-sans" dir="rtl">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-20 relative z-10">
        <FeedHeader count={items.length} lastUpdated={lastUpdated} loading={loading} onRefresh={loadFeed} />

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl p-5 mb-8 text-sm text-center font-semibold shadow-sm">
            <div className="flex items-center justify-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] animate-pulse">
                <div className="flex gap-4 mb-6 items-center">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
                  <div className="flex flex-col gap-2.5 w-full">
                    <div className="h-3.5 bg-slate-200/60 rounded-md w-28" />
                    <div className="h-2.5 bg-slate-100 rounded-md w-16" />
                  </div>
                </div>
                <div className="space-y-3.5 flex flex-col items-start w-full">
                  <div className="h-3.5 bg-slate-100 rounded-md w-full" />
                  <div className="h-3.5 bg-slate-100 rounded-md w-[85%]" />
                  <div className="h-3.5 bg-slate-100 rounded-md w-[60%]" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-7">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} onImageClick={setLightboxSrc} itemIds={itemIds} />
          ))}
        </div>

        {!loading && items.length > 0 && (
          <div className="mt-14 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-sm">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            </div>
            <p className="text-xs text-slate-400 font-bold tracking-widest mt-4">סיימנו, להשתמע!</p>
          </div>
        )}
      </div>
    </div>
  );
}
