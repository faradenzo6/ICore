import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

type Product = { id: number; name: string; sku: string; stock?: number };
type Movement = { id: number; product: Product; type: string; quantity: number; unitPrice?: number|null; unitCost?: number|null; note?: string|null; createdAt: string };

export default function StockPage() {
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [qtyIn, setQtyIn] = useState(1);
  const [priceIn, setPriceIn] = useState<number | ''>('');
  const [salePrice, setSalePrice] = useState<number | ''>('');
  
  // Списание товаров
  const [qtyOut, setQtyOut] = useState(1);
  const [noteOut, setNoteOut] = useState('');

  const [movements, setMovements] = useState<Movement[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');

  async function findProduct() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(query)}&limit=5`);
    setSuggestions(res.items);
    setProduct(res.items[0] || null);
  }

  async function doIn() {
    if (!product) return;
    await apiFetch('/api/stock/in', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: qtyIn, unitPrice: priceIn || undefined, salePrice: salePrice || undefined }) });
    alert('Поступление добавлено');
    loadMovements();
  }

  async function doOut() {
    if (!product) return;
    await apiFetch('/api/stock/out', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: qtyOut, note: noteOut || undefined }) });
    alert('Списание выполнено');
    loadMovements();
    setNoteOut('');
  }

  async function loadMovements() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (type) qs.set('type', type);
    const data = await apiFetch<Movement[]>(`/api/stock/movements?${qs.toString()}`);
    setMovements(data);
  }

  async function loadAllProducts() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?page=1&limit=1000`);
    setAllProducts(res.items);
  }

  useEffect(() => { loadMovements(); }, []);
  useEffect(() => {
    loadAllProducts();
  }, []);

  // Автоматическое обновление каждые 30 секунд
  useAutoRefresh(() => {
    loadMovements();
    loadAllProducts();
  }, 30000);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Склад</h1>

      <div className="card p-4 grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2 relative" onBlur={() => setTimeout(() => setSuggestions([]), 100)}>
          <label className="block text-sm text-neutral-400 mb-1">Поиск товара (название)</label>
          <div className="flex gap-2">
            <input value={query} onChange={async (e) => { setQuery(e.target.value); if (e.target.value.trim()) { const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(e.target.value)}&limit=5`); setSuggestions(res.items); } else { setSuggestions([]); } }} onFocus={findProduct} placeholder="Введите название" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
            <button className="btn" onClick={findProduct}>Найти</button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#1E222B] border border-neutral-700 rounded shadow-lg">
              {suggestions.map((p) => (
                <div key={p.id} className="px-3 py-2 hover:bg-[#2a2f3a] cursor-pointer" onClick={() => { setProduct(p); setQuery(`${p.name}`); setSuggestions([]); }}>
                  {p.name} <span className="text-neutral-400">({p.sku})</span>
                </div>
              ))}
            </div>
          )}
          {/* Отображение выбранного товара в отдельной строке убрано для стабильной сетки */}
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Поступление: кол-во</label>
          <input type="number" value={qtyIn} onChange={(e) => setQtyIn(Math.max(1, Number(e.target.value)))} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Цена закупки</label>
          <input type="number" value={priceIn} onChange={(e) => setPriceIn(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Цена продажи</label>
          <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button className="btn w-full" onClick={doIn} disabled={!product}>Добавить</button>
        </div>
      </div>

      {/* Блок списания товаров */}
      <div className="card p-4 grid gap-3 md:grid-cols-4 items-end">
        <div className="md:col-span-2 relative">
          <label className="block text-sm text-neutral-400 mb-1">Товар для списания</label>
          <div className="flex gap-2">
            <input value={query} onChange={async (e) => { setQuery(e.target.value); if (e.target.value.trim()) { const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(e.target.value)}&limit=5`); setSuggestions(res.items); } else { setSuggestions([]); } }} onFocus={findProduct} placeholder="Введите название" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
            <button className="btn" onClick={findProduct}>Найти</button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#1E222B] border border-neutral-700 rounded shadow-lg">
              {suggestions.map((p) => (
                <div key={p.id} className="px-3 py-2 hover:bg-[#2a2f3a] cursor-pointer" onClick={() => { setProduct(p); setQuery(`${p.name}`); setSuggestions([]); }}>
                  {p.name} <span className="text-neutral-400">({p.sku})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Количество для списания</label>
          <input type="number" value={qtyOut} onChange={(e) => setQtyOut(Math.max(1, Number(e.target.value)))} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Причина списания</label>
          <input value={noteOut} onChange={(e) => setNoteOut(e.target.value)} placeholder="Например: порча, утеря" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button className="btn w-full bg-red-600 hover:bg-red-700" onClick={doOut} disabled={!product}>Списать</button>
        </div>
      </div>

      {/* Товары на складе */}
      <div className="card p-4">
        <div className="font-medium mb-2">Товары на складе</div>
        <div className="overflow-auto max-h-64 border border-neutral-800 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2">Название</th>
                <th className="text-left p-2">Код</th>
                <th className="text-left p-2">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {allProducts.map((p) => (
                <tr key={p.id} className="border-t border-neutral-800">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.sku}</td>
                  <td className="p-2">{typeof p.stock === 'number' ? p.stock : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* История продаж / движений */}
      <div className="card p-4 space-y-3">
        <div className="font-medium">История</div>
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
            <label className="block text-sm text-neutral-400 mb-1">Операция</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="p-2 rounded bg-[#11161f] border border-neutral-700">
              <option value="">Все</option>
              <option value="IN">Поступление</option>
              <option value="OUT">Списание</option>
              <option value="ADJUST">Корректировка</option>
            </select>
          </div>
          <button className="btn" onClick={loadMovements}>Показать</button>
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => { setFrom(''); setTo(''); setType(''); loadMovements(); }}>Сбросить</button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2">Дата</th>
                <th className="text-left p-2">Товар</th>
                <th className="text-left p-2">Операция</th>
                <th className="text-left p-2">Кол-во</th>
                <th className="text-left p-2">Цена закупки</th>
                <th className="text-left p-2">Цена продажи</th>
                <th className="text-left p-2">Чистая прибыль</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-neutral-800">
                  <td className="p-2">{new Date(m.createdAt).toLocaleString('ru-RU')}</td>
                  <td className="p-2">{m.product.name}</td>
                  <td className="p-2">{m.type === 'IN' ? 'Поступление' : m.type === 'OUT' ? 'Продажа' : 'Корректировка'}</td>
                  <td className="p-2">{m.quantity}</td>
                  <td className="p-2">{m.unitCost ? formatUZS(Number(m.unitCost)) : ''}</td>
                  <td className="p-2">{m.unitPrice ? formatUZS(Number(m.unitPrice)) : ''}</td>
                  <td className="p-2">{m.type === 'OUT' && m.unitPrice != null && m.unitCost != null ? formatUZS((Number(m.unitPrice) - Number(m.unitCost)) * m.quantity) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}


