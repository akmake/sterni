import { useEffect, useState, useCallback } from 'react';
import api from '@/utils/api';

/* ── Helpers ── */
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
    <div 
      className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out transition-all duration-300" 
      onClick={onClose}
    >
      <img 
        src={src} 
        alt="תמונה מוגדלת" 
        className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10" 
        onClick={(e) => e.stopPropagation()} 
      />
      <button 
        onClick={onClose} 
        className="absolute top-6 left-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-lg flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* ── Article Content ── */
function YoutubeEmbed({ videoId }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-4 border border-slate-200/60 shadow-sm group aspect-video bg-slate-100">
      <div className="absolute inset-0 animate-pulse group-hover:hidden" />
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
    <div className="mt-6 space-y-4 animate-pulse">
      <div className="h-4 bg-slate-200/60 rounded-md w-full" />
      <div className="h-4 bg-slate-200/60 rounded-md w-11/12" />
      <div className="h-4 bg-slate-200/60 rounded-md w-4/6" />
      <div className="h-48 bg-slate-100 rounded-2xl mt-5" />
    </div>
  );

  if (error || !content?.text) return (
    <div className="mt-6 text-center p-6 bg-red-50/50 border border-red-100 rounded-2xl">
      <p className="text-sm font-medium text-red-600 mb-3">התרחשה שגיאה בטעינת תוכן הכתבה</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors flex items-center justify-center gap-1">
        <span>מעבר לכתבה המקורית ברוטר</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
      </a>
    </div>
  );

  return (
    <div className="mt-6 pt-6 border-t border-slate-100 space-y-6">
      {/* YouTube embeds */}
      {content.youtubeEmbeds?.map((embed, i) =>
        embed.videoId ? <YoutubeEmbed key={i} videoId={embed.videoId} /> : null
      )}

      {/* תמונות */}
      {content.images?.length > 0 && (
        <div className="space-y-4">
          {content.images.map((src, i) => (
            <img key={i} src={src} alt="" className="w-full rounded-2xl object-cover border border-slate-200/60 shadow-sm bg-slate-50"
              style={{ maxHeight: '450px' }} onError={(e) => e.target.style.display = 'none'} />
          ))}
        </div>
      )}

      {/* טקסט גוף הכתבה */}
      {content.text && (
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-line text-[15px] sm:text-base">
          {content.text}
        </div>
      )}

      {/* תגובות */}
      {content.comments?.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-5">
            <h4 className="text-sm font-bold text-slate-900 tracking-wide">תגובות נבחרות</h4>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{content.comments.length}</span>
          </div>
          <div className="space-y-3">
            {content.comments.map((c, i) => (
              <div key={i} className="flex gap-3 text-[14px] text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors hover:bg-slate-100/50">
                <span className="text-slate-400 font-medium text-xs mt-0.5 select-none w-5">{i + 1}.</span>
                <p className="flex-1">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors mt-2 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl">
        <span>לקריאה במקור (רוטר.נט)</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
      </a>
    </div>
  );
}

/* ── VideoPlayer ── */
function VideoPlayer({ src, thumb }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <video src={src} controls autoPlay className="w-full rounded-2xl mb-5 bg-slate-900 border border-slate-200/60 shadow-sm aspect-video object-contain" />;
  }

  return (
    <div className="relative mb-5 rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-slate-200/60 bg-slate-100 aspect-video" onClick={() => setPlaying(true)}>
      {thumb ? (
        <img src={thumb} alt="Video thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full bg-slate-200" />
      )}
      <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/30 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg transform transition-transform duration-300 group-hover:scale-110">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900 ml-1"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
        </div>
      </div>
    </div>
  );
}

/* ── FeedCard ── */
function FeedCard({ item, onImageClick, itemIds }) {
  const [expanded, setExpanded] = useState(false);
  const sourceKey = item.source === 'rotter' ? 'rotter' : item.channel;
  const meta = CHANNEL_META[sourceKey] || { label: sourceKey, color: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-500/20' };
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
    <article id={item.id} className="bg-white rounded-3xl shadow-sm hover:shadow-md ring-1 ring-slate-900/5 transition-all duration-300 overflow-hidden scroll-mt-28">
      <div className="p-5 sm:p-7">
        
        {/* Meta Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center flex-shrink-0 shadow-sm ${meta.shadow}`}>
              <span className="text-white text-sm font-bold">{meta.label[0]}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-slate-900">{meta.label}</span>
              <div className="flex items-center gap-1.5">
                {isRecent && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span></span>}
                <span className={`text-xs font-medium ${isRecent ? 'text-green-600' : 'text-slate-500'}`}>{timeAgo(item.date)}</span>
              </div>
            </div>
          </div>
          
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors" title="צפייה במקור">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </a>
        </div>

        {/* Forwarded Status */}
        {item.forwardedFrom && (
          <a href={item.forwardedFrom.link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
            <span>הועבר מ- <span className="font-bold">{item.forwardedFrom.name}</span></span>
          </a>
        )}

        {/* Reply To */}
        {item.replyText && (
          <div onClick={handleReplyClick}
            className="flex gap-3 mb-5 group/reply cursor-pointer bg-slate-50 p-4 rounded-2xl border-l-4 border-l-blue-500 border border-slate-100 hover:border-slate-200 transition-colors">
            <p className="text-[14px] text-slate-600 group-hover/reply:text-slate-800 leading-relaxed line-clamp-2">{item.replyText}</p>
          </div>
        )}

        {/* Text Content */}
        {item.text && (
          <p className="text-slate-800 text-[15px] sm:text-base leading-relaxed whitespace-pre-line mb-5" dir="auto">
            {item.text}
          </p>
        )}

        {/* Image */}
        {item.image && !item.video && (
          <div className="relative rounded-2xl overflow-hidden ring-1 ring-slate-900/5 cursor-zoom-in mb-5 group" onClick={() => onImageClick(item.image)}>
            <img src={item.image} alt="Media" className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] bg-slate-100"
              style={{ maxHeight: '500px' }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        )}

        {/* Video */}
        {item.video && <VideoPlayer src={item.video} thumb={item.videoThumb} />}

        {/* Rotter Title & Expand Logic */}
        {item.title && (
          <button onClick={() => setExpanded(v => !v)} className="flex items-center justify-between w-full text-right mt-2 group">
            <span className="text-slate-900 text-base sm:text-lg font-bold leading-snug group-hover:text-blue-600 transition-colors pl-4">
              {item.title}
            </span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${expanded ? 'bg-slate-100 text-slate-600 rotate-180' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </div>
          </button>
        )}

        {/* Expanded Article Content */}
        {expanded && item.source === 'rotter' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
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
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-50/80 border-b border-slate-200/60 pb-4 mb-8 pt-6 px-4 sm:px-0 mx-[-16px] sm:mx-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-2xl mx-auto px-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">פיד חדשות</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1.5 font-medium">
            {count > 0 && <span>{count} עדכונים</span>}
            {lastUpdated && (
              <>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2 rounded-full bg-green-500"></span>
                  עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-all shadow-sm active:scale-95 w-full sm:w-auto">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
          <span>{loading ? 'מרענן...' : 'רענון הפיד'}</span>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 font-sans" dir="rtl">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-20 relative">
        <FeedHeader count={items.length} lastUpdated={lastUpdated} loading={loading} onRefresh={loadFeed} />

        {error && (
          <div className="bg-red-50 ring-1 ring-red-100 text-red-600 rounded-2xl p-4 mb-6 text-sm font-medium flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* סקלטון טעינה - תואם במדויק לקלפים החדשים */}
        {loading && items.length === 0 && (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl ring-1 ring-slate-900/5 p-5 sm:p-7 shadow-sm animate-pulse">
                <div className="flex gap-3 mb-5 items-center">
                  <div className="w-10 h-10 bg-slate-200/60 rounded-full flex-shrink-0" />
                  <div className="flex flex-col gap-2 w-full">
                    <div className="h-3.5 bg-slate-200/60 rounded-md w-24" />
                    <div className="h-2.5 bg-slate-100 rounded-md w-16" />
                  </div>
                </div>
                <div className="space-y-3 w-full">
                  <div className="h-3.5 bg-slate-100 rounded-md w-full" />
                  <div className="h-3.5 bg-slate-100 rounded-md w-[90%]" />
                  <div className="h-3.5 bg-slate-100 rounded-md w-[60%]" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} onImageClick={setLightboxSrc} itemIds={itemIds} />
          ))}
        </div>

        {!loading && items.length > 0 && (
          <div className="mt-12 flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
          </div>
        )}
      </div>
    </div>
  );
}