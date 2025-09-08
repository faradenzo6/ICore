import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { apiFetch } from '../lib/api';

type Summary = { period: string; revenue: number; count: number; avg: number; cash?: number; card?: number; profit?: number };
type Top = { name: string; qty: number; revenue: number };
type Category = { id: number; name: string };

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bucket, setBucket] = useState<'day'|'week'|'month'|'year'>('day');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [summary, setSummary] = useState<Summary[]>([]);
  const [top, setTop] = useState<Top[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function load() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('bucket', bucket);
    if (categoryId !== '') qs.set('categoryId', String(categoryId));
    const data = await apiFetch<Summary[]>(`/api/reports/summary?${qs.toString()}`);
    setSummary(data);
    const topParams = new URLSearchParams({ from, to, limit: '5' });
    if (categoryId !== '') topParams.set('categoryId', String(categoryId));
    const topData = await apiFetch<Top[]>(`/api/reports/top-products?${topParams.toString()}`);
    setTop(topData);
  }

  useEffect(() => { load(); }, [bucket]);
  useEffect(() => { (async () => { const cats = await apiFetch<Category[]>('/api/categories'); setCategories(cats); })(); }, []);

  function exportStockCsv() { window.open('/api/reports/stock-export.csv', '_blank'); }
  function exportSalesCsv() { window.open('/api/sales/export.csv', '_blank'); }

  const totalRevenue = useMemo(() => summary.reduce((s, r) => s + r.revenue, 0), [summary]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Отчёты</h1>
      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">От</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">До</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Период</label>
          <select value={bucket} onChange={(e) => setBucket(e.target.value as 'day'|'week'|'month'|'year')} className="p-2 rounded bg-[#11161f] border border-neutral-700">
            <option value="day">День</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
            <option value="year">Год</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Категория</label>
          <select
            value={categoryId === '' ? '' : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            className="p-2 rounded bg-[#11161f] border border-neutral-700"
          >
            <option value="">Все</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={load}>Показать</button>
        <button className="btn" onClick={exportSalesCsv}>Экспорт продаж CSV</button>
        <button className="btn" onClick={exportStockCsv}>Экспорт остатков CSV</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Выручка</div>
          <div className="text-2xl">{formatUZS(totalRevenue)}</div>
        </div>
        <div className="card p-4 md:col-span-3">
          <div className="font-medium mb-2">Выручка по периодам</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#9aa4b2" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9aa4b2" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number | string) => formatUZS(Number(v))} contentStyle={{ background: '#1E222B', border: '1px solid #2a2f3a' }} />
                <Bar dataKey="revenue" stackId="a" name="Выручка" fill="#FF3B3B" />
                <Bar dataKey="profit" stackId="b" name="Прибыль" fill="#22C55E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Наличные</div>
          <div className="text-2xl">{formatUZS(summary.reduce((s, r) => s + (r.cash || 0), 0))}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Карта</div>
          <div className="text-2xl">{formatUZS(summary.reduce((s, r) => s + (r.card || 0), 0))}</div>
        </div>
        <div className="card p-4">
          <div className="text-neutral-400 text-sm">Чистая прибыль</div>
          <div className="text-2xl">{formatUZS(summary.reduce((s, r) => s + (r.profit || 0), 0))}</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="font-medium mb-2">Топ-5 товаров</div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {top.map((t) => (
            <React.Fragment key={t.name}>
              <div className="text-neutral-400">{t.name}</div>
              <div>{t.qty}</div>
              <div>{formatUZS(t.revenue)}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}


