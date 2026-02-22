import { useState, Fragment } from "react";
import { Link, NavLink  } from "react-router-dom";
import { Menu, X, LogOut, Home, Briefcase,Utensils,FileText, ChevronDown,MessageSquare, Settings,MapPin, UserCircle,ListTodo, User, Users,Mail,CalendarDays, CreditCard, Shield, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// --- נתונים ---
const navItems = [
    { to: '/tasks', label: 'מטלות מהירות', icon: ListTodo, type: 'link', auth: true },
    { to: '/projects', label: 'פרויקטים', icon: Briefcase, type: 'link', auth: true },
    { to: '/groups', label: 'ניהול קבוצות', icon: Users, type: 'link', auth: true },
    { to: '/price-quote', label: 'הצעות מחיר', icon: FileText },
    { to: '/payment-requests', label: 'דרישות תשלום', icon: CreditCard, type: 'link', auth: true },
    { to: '/reports/kitchen', label: 'דוח מטבח', icon: Utensils, type: 'link', auth: true },
    { to: '/full-schedule', label: 'לו"ז מפורט', icon: CalendarDays, type: 'link', auth: true },
    { to: '/halls', label: 'ניהול אולמות', icon: MapPin, type: 'link', auth: true },
    //{ to: '/whatsapp', label: 'מערכת צ׳אט', icon: MessageSquare, type: 'link', auth: true }, 
    { to: '/settings', label: 'הגדרות מערכת', icon: Settings, type: 'link', auth: true },
    { to: '/staff-manager', label: 'ניהול מטבח', icon: Utensils, type: 'link', auth: true },
    { to: '/thai-schedule', label: 'לו"ז תאילנדי', icon: CalendarDays, type: 'link', auth: true },
    { to: '/financial-report', label: 'דוחות פיננסיים', icon: FileText, type: 'link', auth: true },
    { to: '/admin/users', label: 'ניהול משתמשים', icon: Shield, type: 'link', auth: true, admin: true },
    { to: '/admin/meals', label: 'ניהול ארוחות', icon: Utensils, type: 'link', auth: true, admin: true },
    { to: '/admin/logs', label: 'דוח מבקרים', icon: BarChart3, type: 'link', auth: true, admin: true },
];

const getVisibleItems = (isAuthenticated, user) => {
    return navItems.filter(item => {
        if (item.auth && !isAuthenticated) return false;
        if (item.admin && user?.role !== 'admin') return false;
        return true;
    });
};

export default function Navbar({ mobileOnly = false }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { isAuthenticated, user, logout } = useAuthStore();
    const visibleItems = getVisibleItems(isAuthenticated, user);

    return (
        <>
            {/* === כפתור צף למובייל === 
                זה הדבר היחיד שיוצג בטלפון כשהתפריט סגור.
            */}
            <div className="md:hidden">
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setSidebarOpen(true)}
                    className="bg-white/90 backdrop-blur shadow-lg border-slate-200 rounded-full h-12 w-12"
                >
                    <Menu className="h-6 w-6 text-slate-700" />
                </Button>
            </div>

            {/* === תפריט צד לדסקטופ (מוצג רק אם אנחנו לא במצב מובייל-בלבד) === */}
            {!mobileOnly && (
                <div className="hidden md:flex md:flex-col h-full w-full">
                    <SidebarContent items={visibleItems} user={user} isAuthenticated={isAuthenticated} logout={logout} />
                </div>
            )}

            {/* === המגירה הנפתחת (Mobile Drawer) === */}
            <AnimatePresence>
                {sidebarOpen && (
                    <Fragment>
                        {/* רקע כהה (Overlay) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/40 md:hidden backdrop-blur-sm"
                            onClick={() => setSidebarOpen(false)}
                        />
                        
                        {/* התפריט עצמו */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 z-[70] w-72 bg-white shadow-2xl md:hidden border-l border-slate-100"
                        >
                            <SidebarContent
                                items={visibleItems}
                                user={user}
                                isAuthenticated={isAuthenticated}
                                logout={logout}
                                onClose={() => setSidebarOpen(false)}
                            />
                        </motion.div>
                    </Fragment>
                )}
            </AnimatePresence>
        </>
    );
}

// --- תוכן התפריט (משותף) ---
function SidebarContent({ items, user, isAuthenticated, logout, onClose }) {
    const handleLogout = () => {
        logout();
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

            {/* רשימת הלינקים */}
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {items.map((item) => (
                    <NavItem key={item.label} item={item} onClick={onClose} />
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
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
                            <Link to="/register" onClick={onClose}>הרשמה</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- פריט ניווט ---
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
            <item.icon className={`ml-3 h-5 w-5 ${({ isActive }) => isActive ? "text-blue-600" : "text-slate-400"}`} />
            {item.label}
        </NavLink>
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
            <DropdownMenuContent className="w-60 mb-2" align="end" side="top">
                <DropdownMenuItem asChild>
                    <Link to="/profile"><UserCircle className="mr-2 h-4 w-4" /><span>פרופיל אישי</span></Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/settings"><Settings className="mr-2 h-4 w-4" /><span>הגדרות מערכת</span></Link>
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