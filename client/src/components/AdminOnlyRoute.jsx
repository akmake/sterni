import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * AdminOnlyRoute - Protects routes that require admin privileges
 * - If user is authenticated and is admin, renders the child route
 * - If user is authenticated but not admin, redirects to /
 * - If user is not authenticated, redirects to /login
 */
const AdminOnlyRoute = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminOnlyRoute;
