import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { toast } from 'sonner';

type Product = { id: number; name: string; sku: string; stock?: number };
type Movement = { id: number; product: Product; type: string; quantity: number; unitPrice?: number|null; unitCost?: number|null; note?: string|null; createdAt: string };

export default function StockPage() {
  // Поиск для добавления товаров
  const [queryIn, setQueryIn] = useState('');
  const [productIn, setProductIn] = useState<Product | null>(null);
  const [suggestionsIn, setSuggestionsIn] = useState<Product[]>([]);
  
  // Поиск для списания товаров
  const [queryOut, setQueryOut] = useState('');
  const [productOut, setProductOut] = useState<Product | null>(null);
  const [suggestionsOut, setSuggestionsOut] = useState<Product[]>([]);
  
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
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(20);

  async function findProductIn() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(queryIn)}&limit=100`);
    // Фильтруем результаты на фронтенде для нечувствительного к регистру поиска
    const filtered = res.items.filter(p => 
      p.name.toLowerCase().includes(queryIn.toLowerCase()) || 
      p.sku.toLowerCase().includes(queryIn.toLowerCase())
    );
    setSuggestionsIn(filtered);
    setProductIn(filtered[0] || null);
  }

  async function findProductOut() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(queryOut)}&limit=100`);
    // Фильтруем результаты на фронтенде для нечувствительного к регистру поиска
    const filtered = res.items.filter(p => 
      p.name.toLowerCase().includes(queryOut.toLowerCase()) || 
      p.sku.toLowerCase().includes(queryOut.toLowerCase())
    );
    setSuggestionsOut(filtered);
    setProductOut(filtered[0] || null);
  }

  async function doIn() {
    if (!productIn) return;
    try {
      await apiFetch('/api/stock/in', { method: 'POST', body: JSON.stringify({ productId: productIn.id, quantity: qtyIn, unitPrice: priceIn || undefined, salePrice: salePrice || undefined }) });
      toast.success('Поступление добавлено');
      await loadMovements();
      await loadAllProducts();
      setQueryIn('');
      setProductIn(null);
      setSuggestionsIn([]);
      setPriceIn('');
      setSalePrice('');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось добавить поступление');
    }
  }

  async function doOut() {
    if (!productOut) return;
    try {
      await apiFetch('/api/stock/out', { method: 'POST', body: JSON.stringify({ productId: productOut.id, quantity: qtyOut, note: noteOut || undefined }) });
      toast.success('Списание выполнено');
      await loadMovements();
      await loadAllProducts();
      setQueryOut('');
      setProductOut(null);
      setSuggestionsOut([]);
      setNoteOut('');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось выполнить списание');
    }
  }

  async function loadMovements() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (type) qs.set('type', type);
    qs.set('page', String(historyPage));
    qs.set('limit', String(historyLimit));
    const data = await apiFetch<{ items: Movement[]; total: number; page: number; limit: number }>(`/api/stock/movements?${qs.toString()}`);
    setMovements(data.items);
    setHistoryTotal(data.total);
  }

  async function loadAllProducts() {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?page=1&limit=1000`);
    setAllProducts(res.items);
  }

  useEffect(() => { loadMovements(); }, [historyPage, from, to, type]);
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
        <div className="md:col-span-2 relative" onBlur={() => setTimeout(() => setSuggestionsIn([]), 100)}>
          <label className="block text-sm text-neutral-400 mb-1">Поиск товара для добавления</label>
          <div className="flex gap-2">
            <input 
              value={queryIn} 
              onChange={async (e) => { 
                setQueryIn(e.target.value); 
                if (e.target.value.trim()) { 
                  const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(e.target.value)}&limit=100`); 
                  // Фильтруем результаты на фронтенде для нечувствительного к регистру поиска
                  const filtered = res.items.filter(p => 
                    p.name.toLowerCase().includes(e.target.value.toLowerCase()) || 
                    p.sku.toLowerCase().includes(e.target.value.toLowerCase())
                  );
                  setSuggestionsIn(filtered); 
                } else { 
                  setSuggestionsIn([]); 
                } 
              }} 
              onFocus={findProductIn} 
              placeholder="Введите название" 
              className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" 
            />
            <button className="btn" onClick={findProductIn}>Найти</button>
          </div>
          {suggestionsIn.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#1E222B] border border-neutral-700 rounded shadow-lg">
              {suggestionsIn.map((p) => (
                <div key={p.id} className="px-3 py-2 hover:bg-[#2a2f3a] cursor-pointer" onClick={() => { setProductIn(p); setQueryIn(`${p.name}`); setSuggestionsIn([]); }}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
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
          <button className="btn w-full" onClick={doIn} disabled={!productIn}>Добавить</button>
        </div>
      </div>

      {/* Блок списания товаров */}
      <div className="card p-4 grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2 relative" onBlur={() => setTimeout(() => setSuggestionsOut([]), 100)}>
          <label className="block text-sm text-neutral-400 mb-1">Поиск товара для списания</label>
          <div className="flex gap-2">
            <input 
              value={queryOut} 
              onChange={async (e) => { 
                setQueryOut(e.target.value); 
                if (e.target.value.trim()) { 
                  const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(e.target.value)}&limit=100`); 
                  // Фильтруем результаты на фронтенде для нечувствительного к регистру поиска
                  const filtered = res.items.filter(p => 
                    p.name.toLowerCase().includes(e.target.value.toLowerCase()) || 
                    p.sku.toLowerCase().includes(e.target.value.toLowerCase())
                  );
                  setSuggestionsOut(filtered); 
                } else { 
                  setSuggestionsOut([]); 
                } 
              }} 
              onFocus={findProductOut} 
              placeholder="Введите название" 
              className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" 
            />
            <button className="btn" onClick={findProductOut}>Найти</button>
          </div>
          {suggestionsOut.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-[#1E222B] border border-neutral-700 rounded shadow-lg">
              {suggestionsOut.map((p) => (
                <div key={p.id} className="px-3 py-2 hover:bg-[#2a2f3a] cursor-pointer" onClick={() => { setProductOut(p); setQueryOut(`${p.name}`); setSuggestionsOut([]); }}>
                  {p.name}
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
        <div></div>
        <div className="md:col-span-1 flex items-end">
          <button className="btn w-full bg-red-600 hover:bg-red-700" onClick={doOut} disabled={!productOut}>Списать</button>
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
              <option value="SALE">Продажа</option>
              <option value="OUT">Списание</option>
              <option value="ADJUST">Корректировка</option>
            </select>
          </div>
          <button className="btn" onClick={() => { setHistoryPage(1); loadMovements(); }}>Показать</button>
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => { setFrom(''); setTo(''); setType(''); setHistoryPage(1); loadMovements(); }}>Сбросить</button>
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
                  <td className="p-2">{m.type === 'IN' ? 'Поступление' : m.type === 'OUT' ? 'Списание' : m.type === 'SALE' ? 'Продажа' : 'Корректировка'}</td>
                  <td className="p-2">{m.quantity}</td>
                  <td className="p-2">{m.unitCost ? formatUZS(Number(m.unitCost)) : ''}</td>
                  <td className="p-2">{m.unitPrice ? formatUZS(Number(m.unitPrice)) : ''}</td>
                  <td className="p-2">{(m.type === 'SALE' || m.type === 'OUT') && m.unitPrice != null && m.unitCost != null ? formatUZS((Number(m.unitPrice) - Number(m.unitCost)) * m.quantity) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Пагинация для истории */}
        {historyTotal > historyLimit && (
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <div className="text-sm text-neutral-400">
              Показано {((historyPage - 1) * historyLimit) + 1}-{Math.min(historyPage * historyLimit, historyTotal)} из {historyTotal}
            </div>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                disabled={historyPage === 1}
              >
                Назад
              </button>
              <span className="px-3 py-1 text-sm">
                Страница {historyPage} из {Math.ceil(historyTotal / historyLimit)}
              </span>
              <button 
                className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setHistoryPage(prev => Math.min(Math.ceil(historyTotal / historyLimit), prev + 1))}
                disabled={historyPage >= Math.ceil(historyTotal / historyLimit)}
              >
                Вперед
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}


