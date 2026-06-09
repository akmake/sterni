import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import api from '@/utils/api';
import { collectDeviceInfo, CONSENT_KEY, CONSENT_VERSION } from '@/utils/deviceInfo.js';

// Everything we collect — disclosed transparently to the visitor
const COLLECTED = [
  { t: 'מידע טכני', d: 'דפדפן, מערכת הפעלה, רזולוציית מסך, שפה ואזור זמן' },
  { t: 'רשת ומיקום', d: 'כתובת IP, ספק האינטרנט, ועיר/מדינה משוערות לפי ה-IP' },
  { t: 'חומרה', d: 'דגם מעבד, זיכרון, כרטיס מסך ומצב סוללה' },
  { t: 'זיהוי ייחודי', d: 'טביעת אצבע דיגיטלית (canvas/WebGL/אודיו/גופנים) ומזהה מתמשך לזיהוי ביקורים חוזרים' },
  { t: 'אבטחה', d: 'כתובות רשת מקומיות (WebRTC) וזיהוי VPN/Proxy — למניעת הונאה ושימוש לרעה' },
  { t: 'שימוש באתר', d: 'דפים שנצפו, זמן שהייה, גלילה, קליקים ודפוסי תנועת עכבר/הקלדה' },
];

const ConsentBanner = () => {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      const dismissed = sessionStorage.getItem('sterni_consent_dismissed');
      const c = raw ? JSON.parse(raw) : null;
      if ((!c || !c.given || c.version !== CONSENT_VERSION) && !dismissed) {
        // Small delay so it doesn't fight the first paint
        const t = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const accept = async () => {
    const record = { given: true, version: CONSENT_VERSION, at: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch { /* ignore */ }
    setShow(false);
    // Audit record on the server (best-effort)
    try {
      const info = collectDeviceInfo();
      await api.post('/logs/consent', {
        fingerprint: info?.fingerprint || null,
        persistentId: info?.signals?.persistentId || null,
        version: CONSENT_VERSION,
        items: COLLECTED.map(c => c.t),
      });
    } catch { /* non-critical */ }
  };

  const dismiss = () => {
    try { sessionStorage.setItem('sterni_consent_dismissed', '1'); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div dir="rtl" className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto bg-slate-800/95 backdrop-blur border border-slate-600/60 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 shrink-0">
              <Shield size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-100">אנחנו אוספים נתוני שימוש</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                כדי לשפר את השירות, לאבטח את המערכת ולמנוע שימוש לרעה, אנו אוספים מידע טכני על המכשיר והשימוש שלך.
                המשך השימוש מהווה הסכמה.
              </p>

              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition"
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                מה בדיוק אנחנו אוספים?
              </button>

              {expanded && (
                <ul className="mt-3 space-y-2 border-t border-slate-700/50 pt-3">
                  {COLLECTED.map((c) => (
                    <li key={c.t} className="text-xs">
                      <span className="font-bold text-slate-200">{c.t}:</span>{' '}
                      <span className="text-slate-400">{c.d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 shrink-0 p-1" title="סגור">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <button onClick={dismiss} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition">
              לא עכשיו
            </button>
            <button onClick={accept} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-500/40 hover:bg-blue-500/30 transition">
              <Check size={14} /> הבנתי ומאשר
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
