import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const is = (path: string) => loc.pathname.startsWith(path);
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr]">
      <header className="border-b border-neutral-800 bg-[var(--panel)]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="font-extrabold text-white text-2xl tracking-wide">iCore</Link>
          <nav className="flex items-center gap-2 text-neutral-200 text-base">
            <Tab to="/sales/new" active={is('/sales')}>Продажа</Tab>
            <Tab to="/stock" active={is('/stock')}>Склад</Tab>
            <Tab to="/credits" active={is('/credits')}>Кредит</Tab>
            {user?.role === 'ADMIN' && <Tab to="/reports" active={is('/reports')}>Отчёты</Tab>}
            {user?.role === 'ADMIN' && <Tab to="/users" active={is('/users')}>Пользователи</Tab>}
          </nav>
          <div className="ml-auto">
            <button className="btn" onClick={() => logout()}>Выйти</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 w-full">
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} className={`px-3 py-1 rounded ${active ? 'bg-[#2a2f3a] text-white' : 'text-neutral-300 hover:bg-[#242834]'}`}>
      {children}
    </Link>
  );
}


