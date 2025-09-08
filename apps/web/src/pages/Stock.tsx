import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type Product = { id: number; name: string; sku: string };
type Movement = { id: number; product: Product; type: string; quantity: number; unitPrice?: number|null; note?: string|null; createdAt: string };

export default function StockPage() {
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [qtyIn, setQtyIn] = useState(1);
  const [priceIn, setPriceIn] = useState<number | ''>('');
  const [qtyOut, setQtyOut] = useState(1);
  const [note, setNote] = useState('');

  const [movements, setMovements] = useState<Movement[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');

  async function findProduct() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(query)}&limit=1`);
    setProduct(res.items[0] || null);
    if (!res.items[0]) alert('Не найдено');
  }

  async function doIn() {
    if (!product) return;
    await apiFetch('/api/stock/in', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: qtyIn, unitPrice: priceIn || undefined, note: note || undefined }) });
    alert('Поступление добавлено');
    loadMovements();
  }

  async function doOut() {
    if (!product) return;
    await apiFetch('/api/stock/out', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: qtyOut, note: note || undefined }) });
    alert('Списание добавлено');
    loadMovements();
  }

  async function loadMovements() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (type) qs.set('type', type);
    const data = await apiFetch<Movement[]>(`/api/stock/movements?${qs.toString()}`);
    setMovements(data);
  }

  useEffect(() => { loadMovements(); }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Склад</h1>

      <div className="card p-4 grid gap-3 md:grid-cols-5 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-neutral-400 mb-1">Поиск товара (SKU/название)</label>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
            <button className="btn" onClick={findProduct}>Найти</button>
          </div>
          {product && <div className="text-sm text-neutral-300 mt-1">Выбран: {product.name} ({product.sku})</div>}
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Поступление: кол-во</label>
          <input type="number" value={qtyIn} onChange={(e) => setQtyIn(Math.max(1, Number(e.target.value)))} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Поступление: цена за единицу</label>
          <input type="number" value={priceIn} onChange={(e) => setPriceIn(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <button className="btn w-full" onClick={doIn} disabled={!product}>Добавить IN</button>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Списание: кол-во</label>
          <input type="number" value={qtyOut} onChange={(e) => setQtyOut(Math.max(1, Number(e.target.value)))} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-neutral-400 mb-1">Примечание</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <button className="btn w-full" onClick={doOut} disabled={!product}>Добавить OUT</button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">От</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700" />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">До</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700" />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700">
              <option value="">Все</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJUST">ADJUST</option>
            </select>
          </div>
          <button className="btn" onClick={loadMovements}>Показать</button>
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => { setFrom(''); setTo(''); setType(''); loadMovements(); }}>Сбросить</button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="text-left p-2">Дата</th>
                <th className="text-left p-2">Товар</th>
                <th className="text-left p-2">Тип</th>
                <th className="text-left p-2">Кол-во</th>
                <th className="text-left p-2">Цена</th>
                <th className="text-left p-2">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-neutral-800">
                  <td className="p-2">{new Date(m.createdAt).toLocaleString('ru-RU')}</td>
                  <td className="p-2">{m.product.name}</td>
                  <td className="p-2">{m.type}</td>
                  <td className="p-2">{m.quantity}</td>
                  <td className="p-2">{m.unitPrice ?? ''}</td>
                  <td className="p-2">{m.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


