import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * UpdateBanner — "גרסה חדשה זמינה" + כפתור עדכון. מותקן ב-App.jsx (מופיע בכל העמודים, גם מחוץ ל-Layout).
 *
 * ה-SW (vite.config.js → workbox skipWaiting/clientsClaim) מחליף את עצמו מיד אחרי פריסה; העמוד הפתוח עדיין
 * מריץ את הקוד הישן. לא טוענים מחדש אוטומטית (כדי לא למחוק טקסט שלא נשמר) — מציגים כפתור.
 * controllerchange בהתקנה ראשונה (לא היה controller) — מתעלמים. בדיקת עדכון: כל שעה + בחזרה ללשונית.
 */
const CHECK_MS = 60 * 60 * 1000;

export default function UpdateBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
        if (!sw) return undefined;
        const hadController = !!sw.controller;
        const onChange = () => { if (hadController) setShow(true); };
        const check = () => { sw.getRegistration().then((r) => r?.update()).catch(() => {}); };
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        sw.addEventListener('controllerchange', onChange);
        document.addEventListener('visibilitychange', onVisible);
        const t = setInterval(check, CHECK_MS);
        return () => {
            sw.removeEventListener('controllerchange', onChange);
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(t);
        };
    }, []);

    if (!show) return null;
    return (
        <div dir="rtl" role="status"
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-slate-900 text-white text-sm rounded-xl shadow-lg pl-2 pr-4 py-2 max-w-[calc(100vw-32px)]">
            <span>גרסה חדשה זמינה</span>
            <button onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg px-3 py-1">
                <RefreshCw className="w-3.5 h-3.5" /> עדכון
            </button>
            <button onClick={() => setShow(false)} aria-label="סגירה" className="p-1 rounded-lg hover:bg-white/10">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
