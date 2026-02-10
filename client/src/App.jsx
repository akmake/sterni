import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

import LoginPage       from "@/pages/LoginPage";
import RegisterPage    from "@/pages/RegisterPage";

/* Project Pages */
import ProjectsPage       from "@/pages/ProjectsPage";
import ProjectPage        from "@/pages/ProjectPage";
import NewProjectPage     from "@/pages/NewProjectPage";
import HallsPage          from "@/pages/HallsPage";
import GroupsPage         from "@/pages/GroupsPage";
import NewGroupPage       from "@/pages/NewGroupPage";     
import GroupDetailsPage   from "@/pages/GroupDetailsPage"; 
import KitchenReportPage  from "@/pages/KitchenReportPage"
import EmailsPage         from './pages/EmailsPage';
import TasksPage          from './pages/TasksPage';
import KitchenPrintPageA3 from './pages/KitchenPrintPageA3'; // וודא נתיב
import FullScheduleReportPage from '@/pages/FullScheduleReportPage'; 
import NotFoundPage from "@/pages/NotFoundPage";
import ChatPage from './pages/ChatPage'; 
import WhatsAppPage from './pages/WhatsAppPage'; 
import PriceQuoteGenerator from './components/PriceQuoteGenerator'; 
import PaymentRequestGenerator from './components/PaymentRequestGenerator';
import SystemSettings from './pages/SystemSettings';
import KitchenStaffManager from './pages/KitchenStaffManager';
import StaffPrintView from './pages/StaffPrintView'; // וודא נתיב
import StaffPrintA3 from "./pages/Staffprinta3";
export default function App() {
  return (
    <Routes>
      {/* --- אזור האפליקציה הרגיל (עם תפריטים ועיצוב) --- */}
      <Route path="/" element={<Layout />}>
        
        <Route index element={<Navigate to="/tasks" replace />} />
      
        <Route path="login"    element={<LoginPage />}    />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/settings" element={<SystemSettings />} />
          <Route path="price-quote" element={<PriceQuoteGenerator />} />
          <Route path="projects"       element={<ProjectsPage />}   />
          <Route path="projects/new"   element={<NewProjectPage />} />
          <Route path="projects/:id"   element={<ProjectPage />}    />
          <Route path="groups"         element={<GroupsPage />} />
          <Route path="groups/new"     element={<NewGroupPage />} />
          <Route path="groups/:id"     element={<GroupDetailsPage />} />
          <Route path="halls"          element={<HallsPage />} />
          <Route path="reports/kitchen" element={<KitchenReportPage />} />
          <Route path="/emails"        element={<EmailsPage />} />
          <Route path="/tasks"         element={<TasksPage />} />
          <Route path="full-schedule" element={<FullScheduleReportPage />} />
          <Route path="/chat/:ticketId" element={<ChatPage />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/groups/:groupId/payment-request" element={<PaymentRequestGenerator />} />
          <Route path="/staff-manager" element={<KitchenStaffManager />} />
          <Route path="/reports/staff-print-a3" element={<StaffPrintA3 />} />  
          <Route path="/staff-print-a3" element={<StaffPrintA3 />} />
          
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* --- אזור ההדפסה והדפים החיצוניים (ללא Layout!) --- */}
      {/* שים לב: זה נמצא מחוץ ל-Route שסוגר את ה-Layout */}
      <Route path="/print/kitchen-a3" element={<KitchenPrintPageA3 />} />

    </Routes>
  );
}