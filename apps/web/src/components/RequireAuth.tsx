import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Array<'ADMIN'|'STAFF'> }) {
  const { user, loading, fetch } = useAuth();
  const location = useLocation();
  const hasFetched = useRef(false);
  
  useEffect(() => { 
    // Вызываем fetch только один раз при монтировании компонента
    if (!hasFetched.current) {
      hasFetched.current = true;
      void fetch(); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  if (loading) return <div className="p-6 text-slate-200">Загрузка…</div>;
  if (!user) {
    const redirectTo = `/login?redirectTo=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={redirectTo} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}


