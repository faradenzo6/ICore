import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { apiFetch } from '../lib/api';

type Summary = {
  period: string;
  revenue: number;
  count: number;
  avg: number;
  cash?: number;
  card?: number;
  credit?: number;
  profit?: number;
  creditUnpaid?: number;
};

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bucket, setBucket] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [summary, setSummary] = useState<Summary[]>([]);

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('bucket', bucket === 'custom' ? 'day' : bucket);
    const data = await apiFetch<Summary[]>(`/api/reports/summary?${qs.toString()}`);
    setSummary(data);
  }

  // Перезагружать данные при изменении любых фильтров
  useEffect(() => {
    load();
  }, [bucket, from, to]);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    if (!from) setFrom(todayStr);
    if (!to) setTo(todayStr);
  }, []);

  useEffect(() => {
    if (bucket === 'day') {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setFrom(todayStr);
      setTo(todayStr);
    } else if (bucket === 'week') {
      const now = new Date();
      const d = new Date(now);
      const day = d.getDay(); // 0-вс ... 1-пн
      const diffToMonday = (day + 6) % 7; // сдвиг до понедельника
      d.setDate(d.getDate() - diffToMonday);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setFrom(`${y}-${m}-${dayStr}`);
      setTo(`${yyyy}-${mm}-${dd}`);
    } else if (bucket === 'month') {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const first = `${yyyy}-${mm}-01`;
      setFrom(first);
      setTo(`${yyyy}-${mm}-${dd}`);
    }
    // Для 'custom' не меняем даты автоматически
  }, [bucket]);

  const totalRevenue = useMemo(() => summary.reduce((s, r) => s + r.revenue, 0), [summary]);
  const totalCash = useMemo(() => summary.reduce((s, r) => s + (r.cash || 0), 0), [summary]);
  const totalCard = useMemo(() => summary.reduce((s, r) => s + (r.card || 0), 0), [summary]);
  const totalCredit = useMemo(() => summary.reduce((s, r) => s + (r.credit || 0), 0), [summary]);
  const totalCreditUnpaid = useMemo(() => summary.reduce((s, r) => s + (r.creditUnpaid || 0), 0), [summary]);
  const totalProfit = useMemo(() => summary.reduce((s, r) => s + (r.profit || 0), 0), [summary]);

  async function downloadExcel() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('bucket', bucket === 'custom' ? 'day' : bucket);
    const url = `/api/reports/export.xlsx?${qs.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Отчёты</h1>
      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Период</label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as 'day' | 'week' | 'month' | 'custom')}
            className="p-2 rounded bg-[#11161f] border border-neutral-700"
          >
            <option value="day">День</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
            <option value="custom">Произвольный период</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">От</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">До</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <button className="btn" onClick={load}>
          Показать
        </button>
        <button className="btn bg-green-600 hover:bg-green-700" onClick={downloadExcel}>
          Скачать Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Наличные</div>
          <div className="text-2xl">{formatUZS(totalCash)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Карта</div>
          <div className="text-2xl">{formatUZS(totalCard)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Кредит (оплачено)</div>
          <div className="text-2xl">{formatUZS(totalCredit)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Кредит (неоплачено)</div>
          <div className="text-2xl text-yellow-400">{formatUZS(totalCreditUnpaid)}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Общая сумма оборота</div>
          <div className="text-2xl">{formatUZS(totalRevenue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-neutral-400 text-sm mb-2">Чистая прибыль</div>
          <div className={`text-3xl font-semibold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatUZS(totalProfit)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm mb-2">Ожидаемая сумма (неоплаченные кредиты)</div>
          <div className="text-3xl font-semibold text-yellow-400">{formatUZS(totalCreditUnpaid)}</div>
        </div>
      </div>

      <div className="card p-4 md:col-span-3">
        <div className="font-medium mb-2">Выручка по периодам</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
              <XAxis dataKey="period" stroke="#9aa4b2" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9aa4b2" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number | string) => formatUZS(Number(v))}
                contentStyle={{ background: '#1E222B', border: '1px solid #2a2f3a' }}
              />
              <Bar dataKey="revenue" stackId="a" name="Выручка" fill="#FF3B3B" />
              <Bar dataKey="profit" stackId="b" name="Прибыль" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
