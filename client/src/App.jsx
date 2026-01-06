
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

import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        
        <Route index element={<Navigate to="/tasks" replace />} />
     
        <Route path="login"    element={<LoginPage />}    />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>

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

        </Route>

     
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}