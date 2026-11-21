import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { getPushState, enablePush, disablePush, sendTestPush } from '@/utils/push';

/**
 * PushOptIn — כפתור הפעלת התראות לטלפון/מחשב (Web Push).
 * בשימוש ב-TasksPage ו-ProjectsPage. Coupled: client/src/utils/push.js
 */
export default function PushOptIn({ className = '' }) {
    const [state, setState] = useState('loading');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => { getPushState().then(setState); }, []);

    const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

    const turnOn = async () => {
        setBusy(true);
        try {
            await enablePush();
            setState('on');
            const { data } = await sendTestPush();
            flash(data.sent ? 'ההתראות פעילות — נשלחה התראת בדיקה' : 'נרשמת, אבל התראת הבדיקה לא נשלחה');
        } catch (err) {
            flash(err.message || 'הפעלת ההתראות נכשלה');
            setState(await getPushState());
        } finally {
            setBusy(false);
        }
    };

    const turnOff = async () => {
        setBusy(true);
        try { await disablePush(); setState('off'); flash('ההתראות כובו במכשיר הזה'); } finally { setBusy(false); }
    };

    if (state === 'loading' || state === 'unsupported' || state === 'disabled') return null;

    const base = 'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors';
    let button;
    if (state === 'needs-install') {
        button = (
            <span className={`${base} bg-amber-50 text-amber-800 border border-amber-200`} title="שיתוף ← הוסף למסך הבית">
                <Smartphone className="w-4 h-4" /> להתראות: התקן למסך הבית
            </span>
        );
    } else if (state === 'denied') {
        button = (
            <span className={`${base} bg-slate-100 text-slate-500`} title="אפשר מחדש בהגדרות האתר בדפדפן">
                <BellOff className="w-4 h-4" /> ההתראות חסומות בדפדפן
            </span>
        );
    } else if (state === 'on') {
        button = (
            <button onClick={turnOff} disabled={busy} className={`${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200`} title="לחץ לכיבוי במכשיר הזה">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} התראות פעילות
            </button>
        );
    } else {
        button = (
            <button onClick={turnOn} disabled={busy} className={`${base} bg-slate-900 text-white hover:bg-slate-800 shadow-sm`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} הפעל התראות לטלפון
            </button>
        );
    }

    return (
        <div className={`flex flex-col items-start gap-1 ${className}`}>
            {button}
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
    );
}
