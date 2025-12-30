import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Toaster } from "@/components/ui/toaster";

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      {/* במובייל: ה-aside מוסתר מהזרם הרגיל (absolute) או מטופל בתוך ה-Navbar 
         בדסקטופ: הוא תופס 64 יחידות רוחב קבועות
      */}
      <aside className="hidden md:flex md:w-64 flex-shrink-0 md:border-l border-slate-200 bg-white z-20">
        <Navbar />
      </aside>

      {/* במובייל אנחנו שמים את ה-Navbar כרכיב צף מעל התוכן */}
      <div className="md:hidden fixed z-50 top-4 right-4">
         <Navbar mobileOnly={true} /> 
      </div>

      {/* אזור התוכן הראשי - תופס את כל המסך */}
      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        <Outlet />
      </main>

      <Toaster />
    </div>
  );
}