import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type Row = { period: string; revenue: number; count: number; avg: number };

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [bucket, setBucket] = useState<'day' | 'week' | 'month' | 'year'>('day');

  useEffect(() => {
    fetch(`/api/reports/summary?bucket=${bucket}`, { credentials: 'include' })
      .then((r) => (r.status === 401 || r.status === 403 ? (location.href = '/login') : r))
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [bucket]);

  const today = rows.at(-1);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Дашборд</h1>
      <div className="flex gap-2">
        {(['day','week','month','year'] as const).map((b) => (
          <button key={b} className={`btn ${bucket===b? 'opacity-100':'opacity-80'}`} onClick={() => setBucket(b)}>{b}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Выручка</div>
          <div className="text-2xl">{formatUZS(today?.revenue ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Чеков</div>
          <div className="text-2xl">{today?.count ?? 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Средний чек</div>
          <div className="text-2xl">{formatUZS(today?.avg ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Период</div>
          <div className="text-2xl">{bucket}</div>
        </div>
      </div>
      <div className="card p-4">
        <h2 className="font-medium mb-2">Выручка по периодам</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
              <XAxis dataKey="period" stroke="#9aa4b2" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9aa4b2" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number | string) => formatUZS(Number(v))} contentStyle={{ background: '#1E222B', border: '1px solid #2a2f3a' }} />
              <Line type="monotone" dataKey="revenue" stroke="#FF6A3D" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}



