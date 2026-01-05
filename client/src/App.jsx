// client/src/App.jsx

// 1. הוסף את Navigate לייבוא [cite: 3]
import { Routes, Route, Navigate } from "react-router-dom";

/* Layout & Route Protection */
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* Public Pages */
// import HomePage from "@/pages/HomePage"; // אפשר למחוק או להשאיר בהערה [cite: 4]
import LoginPage       from "@/pages/LoginPage";
import RegisterPage    from "@/pages/RegisterPage";

/* Project Pages */
import ProjectsPage       from "@/pages/ProjectsPage";
import ProjectPage        from "@/pages/ProjectPage";
import NewProjectPage     from "@/pages/NewProjectPage";
import HallsPage          from "@/pages/HallsPage";
import GroupsPage         from "@/pages/GroupsPage";
import NewGroupPage       from "@/pages/NewGroupPage";     // דף יצירה + יומן
import GroupDetailsPage   from "@/pages/GroupDetailsPage"; // דף ניהול לו"ז
import KitchenReportPage from "@/pages/KitchenReportPage"
import EmailsPage from './pages/EmailsPage';
import TasksPage from './pages/TasksPage';


import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* -------- Public Routes -------- */}
        
        {/* 2. שינוי: במקום להציג את דף הבית, בצע הפניה אוטומטית לפרויקטים [cite: 9] */}
        <Route index element={<Navigate to="/projects" replace />} />
     
        <Route path="login"    element={<LoginPage />}    />
        <Route path="register" element={<RegisterPage />} />

        {/* -------- Protected Routes -------- */}
        <Route element={<ProtectedRoute />}>
          {/* ----- Project Routes Only ----- */}

          <Route path="projects"       element={<ProjectsPage />}   />
          <Route path="projects/new"   element={<NewProjectPage />} />
          <Route path="projects/:id"   element={<ProjectPage />}    />
          <Route path="groups" element={<GroupsPage />} />{/* תצטרך ליצור דף רשימה פשוט או להשתמש בקיים */}
          <Route path="groups/new" element={<NewGroupPage />} />
          <Route path="groups/:id" element={<GroupDetailsPage />} />
          <Route path="halls" element={<HallsPage />} />
          <Route path="reports/kitchen" element={<KitchenReportPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/tasks" element={<TasksPage />} />

        </Route>

     
        {/* -------- 404 -------- */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}