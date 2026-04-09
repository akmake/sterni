import { Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import { useAuthStore } from "@/stores/authStore";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminOnlyRoute from "@/components/AdminOnlyRoute";
import TzitzitRoute from "@/components/TzitzitRoute";

import LoginPage       from "@/pages/LoginPage";

/* Project Pages */
import ProjectsPage       from "@/pages/ProjectsPage";
import ProjectPage        from "@/pages/ProjectPage";
import NewProjectPage     from "@/pages/NewProjectPage";
import PaymentRequestsPage from "@/pages/PaymentRequestsPage";
import PaymentRequestEditorPage from "@/pages/PaymentRequestEditorPage";
import HallsPage          from "@/pages/HallsPage";
import GroupsPage         from "@/pages/GroupsPage";
import NewGroupPage       from "@/pages/NewGroupPage";
import GroupDetailsPage   from "@/pages/GroupDetailsPage";
import GroupSchedulePrintPage from "@/pages/GroupSchedulePrintPage";
import KitchenReportPage  from "@/pages/KitchenReportPage"
import EmailsPage         from './pages/EmailsPage';
import TasksPage          from './pages/TasksPage';
import KitchenPrintPageA3 from './pages/KitchenPrintPageA3';
import FullScheduleReportPage from '@/pages/FullScheduleReportPage';
const NotFoundPage = React.lazy(() => import("@/pages/NotFoundPage"));
import ChatPage from './pages/ChatPage';
import WhatsAppPage from './pages/WhatsAppPage';
import PriceQuoteGenerator from './components/PriceQuoteGenerator';
import PaymentRequestGenerator from './components/PaymentRequestGenerator';
import SystemSettings from './pages/SystemSettings';
import KitchenStaffManager from './pages/KitchenStaffManager';
import StaffPrintView from './pages/StaffPrintView';
import StaffPrintA3 from "./pages/Staffprinta3";
import ThaiSchedulePage from './pages/ThaiSchedulePage';
import GroupPaymentsPage from '@/pages/Grouppaymentspage';
import FinancialReportPage from '@/pages/Financialreportpage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminMealsPage from './pages/AdminMealsPage';
import AdminLogsPage from './pages/AdminLogsPage';
import HotelDataAdminPage from './pages/HotelDataAdminPage';
import UserActivityPage from './pages/UserActivityPage';
import TzitzitManagementPage from './pages/TzitzitManagementPage';
import ProfilePage from './pages/ProfilePage';
import SoftwareLibraryPage from './pages/SoftwareLibraryPage';

/* Hotel Orders */
import HotelOrdersPage from './pages/HotelOrdersPage';
import HotelNewOrderPage from './pages/HotelNewOrderPage';
import HotelEditOrderPage from './pages/HotelEditOrderPage';
import HotelQuotePage from './pages/HotelQuotePage';
import HotelOrderConfirmationPage from './pages/HotelOrderConfirmationPage';

/* Household Pages */
import HouseholdDashboard from './pages/HouseholdDashboard';
import ShoppingListPage from './pages/ShoppingListPage';
import HouseholdTasksPage from './pages/HouseholdTasksPage';
import FamilySettingsPage from './pages/FamilySettingsPage';
import HouseholdProjectsPage from './pages/HouseholdProjectsPage';
import HouseholdProjectPage from './pages/HouseholdProjectPage';
import NewHouseholdProjectPage from './pages/NewHouseholdProjectPage';
import HouseholdQuickTasksPage from './pages/HouseholdQuickTasksPage';

/* Finance Pages */
import FinanceDashboardPage from './pages/FinanceDashboardPage';
import FinanceTransactionsPage from './pages/FinanceTransactionsPage';
import FinanceBudgetPage from './pages/FinanceBudgetPage';
import FinanceRecurringPage from './pages/FinanceRecurringPage';
import FinanceAnalyticsPage from './pages/FinanceAnalyticsPage';
import FinanceDepositsPage from './pages/FinanceDepositsPage';
import FinanceImportPage from './pages/FinanceImportPage';
import FinanceCategoriesPage from './pages/FinanceCategoriesPage';
import FinanceAutomationPage from './pages/FinanceAutomationPage';

// דף בית דינמי לפי תצוגה מועדפת
function DefaultRedirect() {
  const { activeView, user } = useAuthStore();
  const hasHouseholdAccess = user?.householdAccess || false;
  if (activeView === 'household' && hasHouseholdAccess) {
    return <Navigate to="/household/quick-tasks" replace />;
  }
  return <Navigate to="/tasks" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* ─── Main app area (with Layout) ─── */}
      <Route path="/" element={<Layout />}>

        <Route index element={<DefaultRedirect />} />

        <Route path="login"    element={<LoginPage />}    />

        <Route element={<ProtectedRoute />}>
          {/* ★ FIX: Consistent paths — all relative (no leading slash) */}
          <Route path="profile"               element={<ProfilePage />} />
          <Route path="software-library"      element={<SoftwareLibraryPage />} />
          <Route path="settings"              element={<SystemSettings />} />
          <Route path="price-quote"           element={<PriceQuoteGenerator />} />
          <Route path="payment-requests"      element={<PaymentRequestsPage />} />
          <Route path="payment-request/new"   element={<PaymentRequestEditorPage />} />
          <Route path="payment-request/:id"   element={<PaymentRequestEditorPage />} />
          <Route path="projects"              element={<ProjectsPage />} />
          <Route path="projects/new"          element={<NewProjectPage />} />
          <Route path="projects/:id"          element={<ProjectPage />} />
          <Route path="groups"                element={<GroupsPage />} />
          <Route path="groups/new"            element={<NewGroupPage />} />
          <Route path="groups/:id"            element={<GroupDetailsPage />} />
          <Route path="groups/:groupId/payment-request" element={<PaymentRequestGenerator />} />
          <Route path="halls"                 element={<HallsPage />} />
          <Route path="reports/kitchen"       element={<KitchenReportPage />} />
          <Route path="reports/staff-print-a3" element={<StaffPrintA3 />} />
          <Route path="emails"                element={<EmailsPage />} />
          <Route path="tasks"                 element={<TasksPage />} />
          <Route path="full-schedule"         element={<FullScheduleReportPage />} />
          <Route path="chat/:ticketId"        element={<ChatPage />} />
          <Route path="whatsapp"              element={<WhatsAppPage />} />
          <Route path="staff-manager"         element={<KitchenStaffManager />} />
          <Route path="staff-print-a3"        element={<StaffPrintA3 />} />
          <Route path="thai-schedule"         element={<ThaiSchedulePage />} />
          <Route path="groups/:groupId/payments" element={<GroupPaymentsPage />} />
          <Route path="financial-report" element={<FinancialReportPage />} />

          {/* Hotel Orders */}
          <Route path="hotel-orders"                          element={<HotelOrdersPage />} />
          <Route path="hotel-orders/new"                      element={<HotelNewOrderPage />} />
          <Route path="hotel-orders/edit/:orderId"            element={<HotelEditOrderPage />} />
          <Route path="hotel-orders/quote/:orderId"           element={<HotelQuotePage />} />
          <Route path="hotel-orders/confirmation/:orderId"    element={<HotelOrderConfirmationPage />} />

          {/* Household Management */}
          <Route path="household"             element={<HouseholdDashboard />} />
          <Route path="household/shopping"     element={<ShoppingListPage />} />
          <Route path="household/tasks"        element={<HouseholdTasksPage />} />
          <Route path="household/family"       element={<FamilySettingsPage />} />
          <Route path="household/projects"     element={<HouseholdProjectsPage />} />
          <Route path="household/projects/new" element={<NewHouseholdProjectPage />} />
          <Route path="household/projects/:id" element={<HouseholdProjectPage />} />
          <Route path="household/quick-tasks"   element={<HouseholdQuickTasksPage />} />

          {/* Finance Management */}
          <Route path="household/finance"              element={<FinanceDashboardPage />} />
          <Route path="household/finance/transactions"  element={<FinanceTransactionsPage />} />
          <Route path="household/finance/budget"        element={<FinanceBudgetPage />} />
          <Route path="household/finance/recurring"     element={<FinanceRecurringPage />} />
          <Route path="household/finance/analytics"     element={<FinanceAnalyticsPage />} />
          <Route path="household/finance/deposits"      element={<FinanceDepositsPage />} />
          <Route path="household/finance/import"        element={<FinanceImportPage />} />
          <Route path="household/finance/categories"    element={<FinanceCategoriesPage />} />
          <Route path="household/finance/automation"    element={<FinanceAutomationPage />} />
        </Route>

        <Route element={<AdminOnlyRoute />}>
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/meals" element={<AdminMealsPage />} />
          <Route path="admin/logs" element={<AdminLogsPage />} />
          <Route path="admin/hotel-data" element={<HotelDataAdminPage />} />
          <Route path="admin/user-activity" element={<UserActivityPage />} />
        </Route>

        <Route element={<TzitzitRoute />}>
          <Route path="admin/tzitzit" element={<TzitzitManagementPage />} />
        </Route>

        <Route path="*" element={<Suspense fallback={<div className="flex items-center justify-center h-screen">...</div>}><NotFoundPage /></Suspense>} />
      </Route>

      {/* ─── Print pages (outside Layout) ─── */}
      <Route path="/print/kitchen-a3" element={<KitchenPrintPageA3 />} />
      <Route path="/print/group-schedule" element={<GroupSchedulePrintPage />} />

    </Routes>
  );
}