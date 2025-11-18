import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './AppLayout';
const Users = React.lazy(() => import('./pages/Users'));
import { Toaster } from 'sonner';
import RequireAuth from './components/RequireAuth';
import './styles/tailwind.css';
import './styles/theme.css';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Products = React.lazy(() => import('./pages/Products'));
const SalesNew = React.lazy(() => import('./pages/SalesNew'));
const Stock = React.lazy(() => import('./pages/Stock'));
const Credits = React.lazy(() => import('./pages/Credits'));
const Reports = React.lazy(() => import('./pages/Reports'));

const qc = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={qc}>
      <React.Suspense fallback={<div className="p-6 text-slate-200">Загрузка…</div>}>
        <BrowserRouter>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales/new" element={<RequireAuth roles={["ADMIN","STAFF"]}><SalesNew /></RequireAuth>} />
              <Route path="/stock" element={<RequireAuth roles={["ADMIN"]}><Stock /></RequireAuth>} />
              <Route path="/credits" element={<RequireAuth roles={["ADMIN","STAFF"]}><Credits /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
              <Route path="/users" element={<RequireAuth roles={["ADMIN"]}><Users /></RequireAuth>} />
            </Route>
            <Route path="*" element={<Navigate to="/sales/new" replace />} />
          </Routes>
        </BrowserRouter>
      </React.Suspense>
    </QueryClientProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);



