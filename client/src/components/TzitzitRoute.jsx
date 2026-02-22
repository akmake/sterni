import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * TzitzitRoute - מגן על דף ציציות
 * מאפשר גישה למנהלים ולמשתמשים עם הרשאת tzitzitAccess
 */
const TzitzitRoute = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.tzitzitAccess) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default TzitzitRoute;
