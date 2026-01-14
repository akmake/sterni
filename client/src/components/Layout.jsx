import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Calculator from '../components/Calculator';
import { Toaster } from "@/components/ui/toaster";
import { Calculator as CalcIcon } from 'lucide-react'; // אייקון המחשבון

export default function Layout() {
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden relative">
      
      {/* תפריט צד - דסקטופ */}
      <aside className="hidden md:flex md:w-64 flex-shrink-0 md:border-l border-slate-200 bg-white z-20">
        <Navbar />
      </aside>

      {/* תפריט צד - מובייל */}
      <div className="md:hidden fixed z-50 top-4 right-4">
         <Navbar mobileOnly={true} /> 
      </div>

      {/* אזור תוכן ראשי */}
      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        <Outlet />
      </main>

      <Toaster />

      {/* --- הכפתור הצף (כמו וואטסאפ) --- */}
      <button
        onClick={() => setIsCalcOpen(!isCalcOpen)}
        className={`
          fixed bottom-8 left-8 z-50 
          p-4 rounded-full shadow-2xl 
          transition-all duration-300 hover:scale-110 active:scale-95
          flex items-center justify-center
          ${isCalcOpen ? 'bg-red-500 rotate-45' : 'bg-blue-600 hover:bg-blue-700'}
          text-white
        `}
        title="מחשבון מהיר"
      >
        <CalcIcon size={28} strokeWidth={2.5} />
      </button>

      {/* --- המחשבון עצמו --- */}
      <Calculator 
        isOpen={isCalcOpen} 
        onClose={() => setIsCalcOpen(false)} 
      />

    </div>
  );
}