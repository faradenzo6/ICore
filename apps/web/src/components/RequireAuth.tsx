import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Array<'ADMIN'|'STAFF_MANAGER'|'STAFF'> }) {
  const { user, loading, fetch } = useAuth();
  useEffect(() => { fetch(); }, []);
  if (loading) return <div className="p-6">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}


