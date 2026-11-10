import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bell, CheckSquare, ClipboardList, Folder, Home, MessageCircle, Settings, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { companyApi, errorMessage } from './companyApi';
import CenteredCard from './CenteredCard';
import CompanyLoginPage from './CompanyLoginPage';
import JoinPage from './JoinPage';
import TeamPage from './TeamPage';
import MyWorkPage from './MyWorkPage';
import HomePage from './HomePage';
import InboxPage from './InboxPage';
import ChatPage from './ChatPage';
import { useRealtime } from './useRealtime';
import ProjectsPage from './ProjectsPage';
import ProjectPage from './ProjectPage';
import AuditPage from './AuditPage';
import SettingsPage from './SettingsPage';

// Gives this area its own home-screen identity, separate from the main site's PWA.
function useInstallIdentity() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Company OS';
    const restorers = [];

    const applyTag = (selector, tagName, attributes, valueName, value) => {
      let element = document.head.querySelector(selector);
      if (element) {
        const previous = element.getAttribute(valueName);
        element.setAttribute(valueName, value);
        restorers.push(() => element.setAttribute(valueName, previous));
      } else {
        element = document.createElement(tagName);
        Object.entries(attributes).forEach(([key, val]) => element.setAttribute(key, val));
        element.setAttribute(valueName, value);
        document.head.appendChild(element);
        restorers.push(() => element.remove());
      }
    };

    applyTag('link[rel="manifest"]', 'link', { rel: 'manifest' }, 'href', '/company-manifest.webmanifest');
    applyTag('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon' }, 'href', '/company-apple-touch-icon.png');
    applyTag('meta[name="theme-color"]', 'meta', { name: 'theme-color' }, 'content', '#1A56DB');
    applyTag('meta[name="apple-mobile-web-app-capable"]', 'meta', { name: 'apple-mobile-web-app-capable' }, 'content', 'yes');
    applyTag('meta[name="apple-mobile-web-app-title"]', 'meta', { name: 'apple-mobile-web-app-title' }, 'content', 'Company OS');

    return () => {
      document.title = previousTitle;
      restorers.forEach((restore) => restore());
    };
  }, []);
}

const INSTALL_HINT_KEY = 'company-install-hint-dismissed';

function IosInstallHint() {
  const [visible, setVisible] = useState(() => {
    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isInstalled =
      window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(INSTALL_HINT_KEY) === '1';
    } catch {
      // Storage can be unavailable in private browsing; the hint just shows again.
    }
    return isIos && !isInstalled && !dismissed;
  });

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(INSTALL_HINT_KEY, '1');
    } catch {
      // See above.
    }
    setVisible(false);
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-sm px-4 py-2 flex items-center gap-3">
      <span className="flex-1">להתקנה באייפון: לחצו על שיתוף ואז על ״הוספה למסך הבית״.</span>
      <button onClick={dismiss} className="underline shrink-0">הבנתי</button>
    </div>
  );
}

function SetupOrganization({ onCreated }) {
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => companyApi.createOrganization(name),
    onSuccess: onCreated,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <CenteredCard title="הקמת הארגון">
      <p className="text-sm text-gray-600 text-center">אתה תוגדר כבעלים של הארגון.</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="שם החברה"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <button
          disabled={create.isPending}
          className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {create.isPending ? 'יוצר…' : 'יצירה'}
        </button>
      </form>
    </CenteredCard>
  );
}

const NAV_ITEMS = [
  { to: '/company/home', label: 'בית', icon: Home },
  { to: '/company/chat', label: 'שיחות', icon: MessageCircle, badge: 'unread' },
  { to: '/company/my-work', label: 'העבודה שלי', icon: CheckSquare },
  { to: '/company/projects', label: 'פרויקטים', icon: Folder },
  { to: '/company/team', label: 'צוות', icon: Users, permission: 'view_members', desktopOnly: true },
  { to: '/company/audit', label: 'יומן פעולות', icon: ClipboardList, permission: 'view_audit', desktopOnly: true },
  { to: '/company/settings', label: 'הגדרות', icon: Settings },
];

function NavItems({ permissions, unread }) {
  return NAV_ITEMS.filter((item) => !item.permission || permissions[item.permission]).map((item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          `${item.desktopOnly ? 'hidden sm:flex' : 'flex'} relative flex-1 sm:flex-none flex-col sm:flex-row items-center gap-0.5 sm:gap-2 ` +
          `px-1 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold whitespace-nowrap ` +
          (isActive ? 'text-blue-700 sm:bg-blue-700 sm:text-white' : 'text-gray-500 sm:text-gray-700 sm:hover:bg-gray-100')
        }
      >
        <Icon size={20} aria-hidden="true" className="sm:w-4 sm:h-4" />
        {item.label}
        {item.badge === 'unread' && unread > 0 && (
          <span className="absolute top-0 left-1/4 sm:static bg-red-600 text-white text-[10px] rounded-full min-w-4 px-1 text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </NavLink>
    );
  });
}

function Workspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logoutStore = useAuthStore((state) => state.logout);
  const me = useQuery({ queryKey: ['company', 'me'], queryFn: companyApi.me });

  const signOut = async () => {
    try {
      await companyApi.logout();
    } catch {
      // The local session is cleared regardless.
    }
    logoutStore();
    queryClient.removeQueries({ queryKey: ['company'] });
    navigate('/company/login', { replace: true });
  };

  if (me.isPending) return <CenteredCard><p className="text-center">טוען…</p></CenteredCard>;

  if (me.isError) {
    return (
      <CenteredCard title="לא הצלחנו לטעון">
        <p className="text-sm text-center text-gray-600">{errorMessage(me.error)}</p>
        <button onClick={() => me.refetch()} className="w-full bg-blue-700 text-white rounded-lg py-2">
          נסה שוב
        </button>
      </CenteredCard>
    );
  }

  const membership = me.data.memberships[0];

  if (!membership) {
    if (me.data.can_create_organization) {
      return (
        <SetupOrganization
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['company', 'me'] })}
        />
      );
    }
    return (
      <CenteredCard title="אין לך גישה">
        <p className="text-sm text-center text-gray-600">
          החשבון {me.data.user.email} לא משויך לארגון, או שהגישה שלו בוטלה. בקש ממנהל הזמנה.
        </p>
        <button onClick={signOut} className="w-full border rounded-lg py-2">התנתקות</button>
      </CenteredCard>
    );
  }

  return <ActiveWorkspace me={me.data} membership={membership} onSignOut={signOut} />;
}

function ActiveWorkspace({ me, membership, onSignOut }) {
  const { organization, permissions } = membership;
  useRealtime(organization.id);

  const conversations = useQuery({
    queryKey: ['company', organization.id, 'conversations'],
    queryFn: () => companyApi.conversations(organization.id),
  });
  const unread = (conversations.data ?? []).reduce((sum, item) => sum + (item.muted ? 0 : item.unread_count), 0);
  const inbox = useQuery({
    queryKey: ['company', organization.id, 'notifications'],
    queryFn: () => companyApi.notifications(organization.id),
  });
  const inboxUnread = inbox.data?.meta.unread ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <IosInstallHint />
      <header className="bg-blue-800 text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-bold truncate">{organization.name}</span>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-blue-100 truncate">{me.user.name}</span>
            <Link to="/company/inbox" className="relative shrink-0" aria-label="דואר נכנס">
              <Bell size={20} />
              {inboxUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] rounded-full min-w-4 px-1 text-center">{inboxUnread}</span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <div className="hidden sm:block bg-white border-b sticky top-12 z-10">
        <nav className="max-w-5xl mx-auto px-4 py-2 flex gap-1">
          <NavItems permissions={permissions} unread={unread} />
        </nav>
      </div>
      <main className="max-w-5xl mx-auto p-3 sm:p-4 pb-20 sm:pb-4">
        <Routes>
          <Route index element={<Navigate to="/company/home" replace />} />
          <Route path="home" element={<HomePage membership={membership} userName={me.user.name} />} />
          <Route path="chat" element={<ChatPage membership={membership} currentUserId={me.user.id} />} />
          <Route path="chat/:conversationId" element={<ChatPage membership={membership} currentUserId={me.user.id} />} />
          <Route path="inbox" element={<InboxPage membership={membership} />} />
          <Route path="my-work" element={<MyWorkPage membership={membership} />} />
          <Route path="projects" element={<ProjectsPage membership={membership} />} />
          <Route path="projects/:projectId" element={<ProjectPage membership={membership} />} />
          <Route path="team" element={<TeamPage membership={membership} />} />
          <Route path="audit" element={<AuditPage membership={membership} />} />
          <Route path="settings" element={<SettingsPage membership={membership} user={me.user} onSignOut={onSignOut} />} />
          <Route path="*" element={<Navigate to="/company/home" replace />} />
        </Routes>
      </main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t flex px-1 py-1">
        <NavItems permissions={permissions} unread={unread} />
      </nav>
    </div>
  );
}

function RequireSession({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={`/company/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}

export default function CompanyApp() {
  useInstallIdentity();

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-800">
      <Routes>
        <Route path="login" element={<CompanyLoginPage />} />
        <Route path="join/:token" element={<JoinPage />} />
        <Route path="*" element={<RequireSession><Workspace /></RequireSession>} />
      </Routes>
    </div>
  );
}
