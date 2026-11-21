import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Navbar from './Navbar';
import AssignmentAlerts from './AssignmentAlerts';
import Calculator from '../components/Calculator';
import { Toaster } from "@/components/ui/toaster";
import { Calculator as CalcIcon } from 'lucide-react'; // אייקון המחשבון

// כותרת לסרגל העליון במובייל (לפי תחילת הנתיב; הארוך ביותר קודם)
const MOBILE_TITLES = [
  ['/household/finance', 'כספים'], ['/household/quick-tasks', 'משימות מהירות'], ['/household/projects', 'פרויקטים'],
  ['/household/shopping', 'קניות'], ['/household/tasks', 'משימות בית'], ['/household/family', 'משפחה'], ['/household', 'משק בית'],
  ['/tasks', 'מטלות'], ['/projects', 'פרויקטים'], ['/groups', 'קבוצות'], ['/hotel-orders', 'הזמנות מלון'],
  ['/whatsapp', 'WhatsApp'], ['/news', 'חדשות'], ['/admin/whatsapp-monitor', 'מעקב וואצפ'], ['/admin/users', 'משתמשים'],
  ['/admin', 'ניהול'], ['/settings', 'הגדרות'], ['/profile', 'פרופיל'], ['/emails', 'מיילים'],
  ['/price-quote', 'הצעות מחיר'], ['/payment-request', 'דרישות תשלום'], ['/reports', 'דוחות'], ['/software-library', 'ספריית תוכנות'],
];
const titleFor = (pathname) => MOBILE_TITLES.find(([p]) => pathname.startsWith(p))?.[1] || 'yosefdahan';

export default function Layout() {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { pathname } = useLocation();
  const showMobileBar = isAuthenticated && pathname !== '/login';

  // משתמש צופה וואצפ רואה רק את עמוד הצפייה — בלי תפריט ובלי שאר המערכת
  if (user?.role === 'wa-viewer' && pathname !== '/login') {
    return <Navigate to="/wa-view" replace />;
  }

  return (
    <div dir="rtl" className="flex h-[100dvh] bg-slate-50 text-slate-800 overflow-hidden relative">
      
      {/* תפריט צד - דסקטופ */}
      <aside className="hidden md:flex md:w-64 flex-shrink-0 md:border-l border-slate-200 bg-white z-20">
        <Navbar />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* סרגל עליון - מובייל (במקום כפתור צף שמסתיר תוכן) */}
        {showMobileBar && (
          <header className="md:hidden shrink-0 z-30 h-14 px-2 flex items-center gap-1 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 pt-[env(safe-area-inset-top)] box-content">
            <Navbar mobileOnly={true} />
            <h1 className="flex-1 text-[17px] font-bold text-slate-900 truncate">{titleFor(pathname)}</h1>
          </header>
        )}

        {/* אזור תוכן ראשי */}
        <main className="flex-1 overflow-y-auto overscroll-contain relative z-10 w-full">
          <Outlet />
        </main>
      </div>

      <Toaster />
      <AssignmentAlerts />

      {/* --- הכפתור הצף (כמו וואטסאפ) --- */}
      <button
        onClick={() => setIsCalcOpen(!isCalcOpen)}
        className={`
          fixed bottom-5 left-5 md:bottom-8 md:left-8 z-[51] 
          p-3 md:p-4 rounded-full shadow-2xl 
          transition-all duration-300 hover:scale-110 active:scale-95
          flex items-center justify-center
          ${isCalcOpen ? 'bg-red-500 rotate-45' : 'bg-blue-600 hover:bg-blue-700'}
          text-white
        `}
        title="מחשבון מהיר"
      >
        <CalcIcon className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
      </button>

      {/* --- המחשבון עצמו --- */}
      <Calculator 
        isOpen={isCalcOpen} 
        onClose={() => setIsCalcOpen(false)} 
      />

    </div>
  );
}