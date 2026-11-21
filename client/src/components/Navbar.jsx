import { useState, Fragment } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, Briefcase, Utensils, FileText, ChevronDown, ChevronUp, Settings, UserCircle, ListTodo, User, Users, CalendarDays, CreditCard, Shield, BarChart3, Scissors, FolderPlus, ClipboardList, Home, ArrowLeftRight, ShoppingCart, ClipboardCheck, Wallet, FolderKanban, Landmark, Hotel, Monitor, DollarSign, Tag, MapPin, MessageCircle, Newspaper, Smartphone, FileSpreadsheet, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import useLogout from "@/hooks/useLogout";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// --- פריטי ניווט לפי תצוגה ---
const getHouseholdNav = (hasTzitzitAccess, isAdmin) => {
  const items = [
    { to: '/household/quick-tasks', label: 'משימות מהירות', icon: ListTodo, type: 'link' },
    { to: '/household/projects', label: 'פרויקטים', icon: FolderKanban, type: 'link' },
    { to: '/household/shopping', label: 'קניות', icon: ShoppingCart, type: 'link' },
    { to: '/household/finance/transactions', label: 'כספים', icon: Landmark, type: 'link' },
  ];
  if (hasTzitzitAccess) {
    items.push({ to: '/admin/tzitzit', label: 'ציציות', icon: Scissors, type: 'link' });
  }
  items.push({ to: '/household/tasks', label: 'משימות בית', icon: ClipboardCheck, type: 'link' });
  items.push({ to: '/software-library', label: 'ספריית תוכנות', icon: Monitor, type: 'link' });
  items.push({ to: '/news', label: 'חדשות', icon: Newspaper, type: 'link' });
  if (isAdmin) items.push(...waMonitorNav);
  return items;
};

// קיצורי מעקב וואצפ לאדמין — מופיעים ישירות בתפריט הצד בשתי התצוגות
const waMonitorNav = [
  { to: '/admin/whatsapp-monitor', label: 'מעקב וואצפ', icon: MessageCircle, type: 'link' },
  { to: '/wa-view', label: "צ'אט במעקב", icon: Eye, type: 'link' },
];

const getManagementNav = (isAuthenticated, isAdmin, hasTzitzitAccess) => {
  const items = [];

  // משתמש לא מחובר — אין תפריט (כל הדפים מוגנים ב-ProtectedRoute)
  if (!isAuthenticated) return items;

  if (hasTzitzitAccess) {
    items.push({ to: '/admin/tzitzit', label: 'ניהול ציציות', icon: Scissors, type: 'link' });
  }

  items.push(
    { to: '/tasks', label: 'מטלות מהירות', icon: ListTodo, type: 'link' },
    { to: '/projects', label: 'פרויקטים', icon: Briefcase, type: 'link' },
    { to: '/groups', label: 'ניהול קבוצות', icon: Users, type: 'link' },
    { to: '/hotel-orders', label: 'הזמנות מלון', icon: Hotel, type: 'link' },
    { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, type: 'link' },
    { to: '/news', label: 'חדשות', icon: Newspaper, type: 'link' }
  );
  if (isAdmin) items.push(...waMonitorNav);

  items.push({
    label: 'יצירת קבצים',
    icon: FolderPlus,
    type: 'dropdown',
    children: [
      { to: '/price-quote', label: 'הצעות מחיר', icon: FileText },
      { to: '/price-quote-v2', label: 'הצעות מחיר משודרג', icon: FileText },
      { to: '/price-quote-template', label: 'יצירת תבניות', icon: FileText },
      { to: '/payment-requests', label: 'דרישות תשלום', icon: CreditCard },
    ]
  });

  items.push({
    label: 'דוחות',
    icon: ClipboardList,
    type: 'dropdown',
    children: [
      { to: '/reports/kitchen', label: 'דוח מטבח', icon: Utensils },
      { to: '/full-schedule', label: 'לו"ז מפורט', icon: CalendarDays },
      { to: '/staff-manager', label: 'ניהול מטבח', icon: Utensils },
      { to: '/thai-schedule', label: 'לו"ז תאילנדי', icon: CalendarDays },
    ]
  });

  if (isAdmin) {
    items.push({
      label: 'ניהול מערכת',
      icon: Shield,
      type: 'dropdown',
      children: [
        { to: '/admin/meals', label: 'ניהול ארוחות', icon: Utensils },
        { to: '/admin/users', label: 'ניהול משתמשים', icon: Users },
        { to: '/admin/hotels', label: 'ניהול מלונות', icon: Hotel },
        { to: '/halls', label: 'ניהול אולמות', icon: MapPin },
        { to: '/admin/pricelists', label: 'ניהול מחירונים', icon: DollarSign },
        { to: '/admin/extras', label: 'ניהול תוספות', icon: Tag },
        { to: '/settings', label: 'הגדרות מערכת', icon: Settings },
        { to: '/admin/logs', label: 'דוח מבקרים', icon: BarChart3 },
        { to: '/admin/commissions', label: 'דוח עמלות', icon: FileSpreadsheet },
        { to: '/admin/tether', label: 'Tether — ניהול מכשירים', icon: Smartphone },
      ]
    });
  } else if (isAuthenticated) {
    items.push({ to: '/settings', label: 'הגדרות מערכת', icon: Settings, type: 'link' });
  }

  return items;
};

export default function Navbar({ mobileOnly = false }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user, activeView, toggleView } = useAuthStore();
    const isAdmin = user?.role === 'admin';
    const hasTzitzitAccess = user?.tzitzitAccess || false;
    const hasHouseholdAccess = user?.householdAccess || false;
    const canSwitch = hasHouseholdAccess; // יכול לעבור בין תצוגות אם יש לו גישת משק בית

    const navItems = activeView === 'household' && hasHouseholdAccess
      ? getHouseholdNav(hasTzitzitAccess, isAdmin)
      : getManagementNav(isAuthenticated, isAdmin, hasTzitzitAccess);

    const handleSwitchView = () => {
      const nextView = toggleView();
      setSidebarOpen(false);
      navigate(nextView === 'household' ? '/household/quick-tasks' : '/tasks');
    };

    // ── קיצורים בתפריט התחתון (מובייל) — לפי תצוגה פעילה; השאר תחת "עוד" ──
    const inHousehold = activeView === 'household' && hasHouseholdAccess;
    const tabs = inHousehold
      ? [
          { to: '/household/quick-tasks', label: 'משימות', icon: ListTodo },
          { to: '/household/projects', label: 'פרויקטים', icon: FolderKanban },
          { to: '/household/shopping', label: 'קניות', icon: ShoppingCart },
          { to: '/household/finance', label: 'כספים', icon: Landmark },
        ]
      : [
          { to: '/tasks', label: 'מטלות', icon: ListTodo },
          { to: '/projects', label: 'פרויקטים', icon: Briefcase },
          { to: '/groups', label: 'קבוצות', icon: Users },
          { to: '/hotel-orders', label: 'מלונות', icon: Hotel },
        ];
    const isTabActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');
    const moreActive = !tabs.some((t) => isTabActive(t.to));

    return (
        <>
            {/* === תפריט צד לדסקטופ === */}
            {!mobileOnly && (
                <div className="hidden md:flex md:flex-col h-full w-full">
                    <SidebarContent items={navItems} user={user} isAuthenticated={isAuthenticated} canSwitch={canSwitch} activeView={activeView} onSwitchView={handleSwitchView} />
                </div>
            )}

            {/* === מובייל: תפריט תחתון + גיליון "עוד" === */}
            {/* פורטל ל-body כדי לא להיות תלוי באבות עם transform/filter (שגורמים ל-fixed להימדד ביחס אליהם) */}
            {isAuthenticated && createPortal(
              <div className="md:hidden" dir="rtl">
                <nav
                  aria-label="ניווט ראשי"
                  className="fixed bottom-0 inset-x-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
                >
                  <div className="grid grid-cols-5 h-16">
                    {tabs.map((t) => {
                      const active = isTabActive(t.to);
                      return (
                        <NavLink key={t.to} to={t.to} onClick={() => setSidebarOpen(false)}
                          className="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                          <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                            <t.icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                          </span>
                          <span className={`text-[11px] leading-none ${active ? 'font-bold text-blue-700' : 'font-medium text-slate-500'}`}>{t.label}</span>
                        </NavLink>
                      );
                    })}
                    <button type="button" onClick={() => setSidebarOpen(true)} aria-label="עוד"
                      className="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                      <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${moreActive || sidebarOpen ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                        <Menu className="w-[22px] h-[22px]" strokeWidth={moreActive ? 2.3 : 1.8} />
                      </span>
                      <span className={`text-[11px] leading-none ${moreActive || sidebarOpen ? 'font-bold text-blue-700' : 'font-medium text-slate-500'}`}>עוד</span>
                    </button>
                  </div>
                </nav>

                <AnimatePresence>
                  {sidebarOpen && (
                    <Fragment>
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-[2px]"
                        onClick={() => setSidebarOpen(false)}
                      />
                      <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) setSidebarOpen(false); }}
                        className="fixed inset-x-0 bottom-0 z-[120] h-[82dvh] rounded-t-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
                      >
                        <div className="shrink-0 pt-2 pb-1 flex justify-center cursor-grab">
                          <span className="w-10 h-1.5 rounded-full bg-slate-300" />
                        </div>
                        <div className="flex-1 min-h-0">
                          <SidebarContent
                            items={navItems}
                            user={user}
                            isAuthenticated={isAuthenticated}
                            onClose={() => setSidebarOpen(false)}
                            canSwitch={canSwitch}
                            activeView={activeView}
                            onSwitchView={handleSwitchView}
                            sheet
                          />
                        </div>
                      </motion.div>
                    </Fragment>
                  )}
                </AnimatePresence>
              </div>,
              document.body
            )}
        </>
    );
}

// --- תוכן התפריט (משותף) ---
function SidebarContent({ items, user, isAuthenticated, onClose, canSwitch, activeView, onSwitchView, sheet = false }) {
    const { mutate: serverLogout } = useLogout();
    const handleLogout = () => {
        serverLogout();
        if (onClose) onClose();
    };

    return (
        <div className="flex flex-col h-full bg-white text-slate-800">
            {/* כותרת התפריט */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <Link to="/tasks" onClick={onClose} className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    yosefdahan
                </Link>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="-ml-2">
                        <X className="h-5 w-5 text-slate-400" />
                    </Button>
                )}
            </div>

            {/* כפתור מעבר בין תצוגות */}
            {canSwitch && (
                <div className="px-4 pt-4">
                    <button
                        onClick={onSwitchView}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200 shadow-sm"
                    >
                        <ArrowLeftRight className="h-4 w-4" />
                        {activeView === 'household' ? 'עבור לניהול' : 'עבור למשק בית'}
                    </button>
                </div>
            )}

            {/* רשימת הלינקים */}
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {items.map((item, index) => (
                    item.type === 'dropdown' 
                        ? <NavDropdown key={item.label} item={item} onClick={onClose} />
                        : <NavItem key={item.to || index} item={item} onClick={onClose} />
                ))}
            </div>

            {/* חלק תחתון - משתמש */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                {isAuthenticated ? (
                    <UserNav user={user} logout={handleLogout} />
                ) : (
                    <div className="grid gap-3">
                        <Button variant="outline" asChild className="w-full justify-start border-slate-200">
                            <Link to="/login" onClick={onClose}><User className="ml-2 h-4 w-4" />התחברות</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- פריט ניווט רגיל ---
function NavItem({ item, onClick }) {
    return (
        <NavLink
            to={item.to}
            onClick={onClick}
            className={({ isActive }) => `
                flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive 
                    ? "bg-blue-50 text-blue-700 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}
            `}
        >
            <item.icon className="ml-3 h-5 w-5" />
            {item.label}
        </NavLink>
    );
}

// --- תפריט נפתח ---
function NavDropdown({ item, onClick }) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    
    // בדוק אם אחד מהילדים פעיל
    const isChildActive = item.children?.some(child => location.pathname === child.to);

    return (
        <div className="space-y-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${isChildActive 
                        ? "bg-blue-50 text-blue-700" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}
                `}
            >
                <div className="flex items-center">
                    <item.icon className="ml-3 h-5 w-5" />
                    {item.label}
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mr-4 pr-4 border-r-2 border-slate-200 space-y-1">
                            {item.children.map((child) => (
                                <NavLink
                                    key={child.to}
                                    to={child.to}
                                    onClick={onClick}
                                    className={({ isActive }) => `
                                        flex items-center px-4 py-2.5 rounded-lg text-sm transition-all duration-200
                                        ${isActive 
                                            ? "bg-blue-100 text-blue-700 font-medium" 
                                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}
                                    `}
                                >
                                    <child.icon className="ml-2 h-4 w-4" />
                                    {child.label}
                                </NavLink>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- תפריט משתמש תחתון ---
function UserNav({ user, logout }) {
     const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name[0].toUpperCase();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="w-full outline-none">
                 <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-200">
                        {getInitials(user?.name)}
                    </div>
                    <div className="text-start flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{user?.name || 'משתמש'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <ChevronDown size={16} className="text-slate-400" />
                 </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60 mb-2 z-[130]" align="end" side="top">
                <DropdownMenuItem asChild>
                    <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /><span>פרופיל אישי</span></Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/household/family"><Users className="mr-2 h-4 w-4" /><span>משפחה</span></Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>יציאה מהמערכת</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
