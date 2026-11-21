import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, FolderKanban, X } from 'lucide-react';
import { connectSocket } from '@/utils/socket';
import { useAuthStore } from '@/stores/authStore';

/**
 * AssignmentAlerts — התראה בתוך האפליקציה (בכל עמוד שב-Layout) כשמישהו יוצר עבורך מטלה/פרויקט.
 * מאזין ל-'tasks:changed' / 'projects:changed' עם action 'created' (assignmentNotifier.js),
 * מציג באנר עם צליל קצר; לחיצה פותחת את המטלה/הפרויקט. משלים את ה-Web Push (שמגיע גם כשהאפליקציה סגורה).
 * Coupled: server/services/assignmentNotifier.js (payload: title, body, url), Layout.jsx
 */

const beep = () => {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [0, 0.18].forEach((t, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = i ? 1046 : 784;
            g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
            o.connect(g).connect(ctx.destination);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.17);
        });
        setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch (_) { /* הדפדפן חוסם צליל לפני אינטראקציה — לא נורא */ }
};

export default function AssignmentAlerts() {
    const { isAuthenticated } = useAuthStore();
    const [alerts, setAlerts] = useState([]);
    const navigate = useNavigate();
    const seq = useRef(0);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        const socket = connectSocket();
        const make = (kind) => (p) => {
            if (p?.action !== 'created' || !p.title) return;
            const id = ++seq.current;
            setAlerts((a) => [...a.slice(-2), { id, kind, title: p.title, body: p.body, url: p.url }]);
            beep();
            if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
            setTimeout(() => setAlerts((a) => a.filter((x) => x.id !== id)), 12000);
        };
        const onTask = make('task');
        const onProject = make('project');
        socket?.on('tasks:changed', onTask);
        socket?.on('projects:changed', onProject);
        return () => {
            socket?.off('tasks:changed', onTask);
            socket?.off('projects:changed', onProject);
        };
    }, [isAuthenticated]);

    if (!alerts.length) return null;

    return (
        <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none" dir="rtl">
            {alerts.map((a) => {
                const Icon = a.kind === 'task' ? ListTodo : FolderKanban;
                return (
                    <div key={a.id}
                        className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-200 ring-4 ring-emerald-500/10 flex items-start gap-3 p-4 animate-in slide-in-from-top-4 fade-in duration-300">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5" />
                        </div>
                        <button className="flex-1 min-w-0 text-right" onClick={() => {
                            setAlerts((x) => x.filter((y) => y.id !== a.id));
                            if (a.url) navigate(a.url);
                        }}>
                            <div className="font-bold text-slate-900 text-sm">{a.title}</div>
                            {a.body && <div className="text-sm text-slate-600 mt-0.5 line-clamp-2">{a.body}</div>}
                            <div className="text-xs text-emerald-700 font-semibold mt-1.5">לחץ לפתיחה ←</div>
                        </button>
                        <button onClick={() => setAlerts((x) => x.filter((y) => y.id !== a.id))} className="text-slate-400 hover:text-slate-600 p-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
