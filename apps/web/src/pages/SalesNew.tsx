import React, { useEffect, useMemo, useState } from 'react';
import ScannerDialog from '../components/ScannerDialog';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

type Product = { id: number; name: string; sku: string; price: number };
type CartItem = { product: Product; quantity: number; unitPrice: number };

export default function SalesNew() {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<'cash' | 'card' | ''>('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  async function addByName(name: string) {
    const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(name)}&limit=5`);
    const product = res.items.find(p => p.name.toLowerCase().includes(name.toLowerCase())) || res.items[0];
    if (!product) { alert('Товар не найден'); return; }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { product, quantity: 1, unitPrice: product.price }];
    });
  }

  const total = useMemo(() => cart.reduce((s, it) => s + it.quantity * it.unitPrice, 0), [cart]);

  async function pay() {
    if (!cart.length) return;
    const items = cart.map((i) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice }));
    try {
      await apiFetch<{ id: number }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify({ items, discount: discount || undefined, paymentMethod: payment || undefined }),
      });
      // Продажа фиксируется, чек не скачиваем
      setCart([]); setDiscount(0); setPayment('');
      toast.success('Продажа оформлена');
    } catch {
      toast.error('Не удалось оформить продажу');
    }
  }

  function inc(id: number) { setCart((c) => c.map((it) => it.product.id === id ? { ...it, quantity: it.quantity + 1 } : it)); }
  function dec(id: number) { setCart((c) => c.map((it) => it.product.id === id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it)); }
  function del(id: number) { setCart((c) => c.filter((it) => it.product.id !== id)); }

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) { setSuggestions([]); return; }
      const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number }>(`/api/products?search=${encodeURIComponent(query)}&limit=5`);
      setSuggestions(res.items);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Новая продажа</h1>
      <div className="flex gap-3 items-start">
        <div className="relative w-full max-w-xl">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { addByName(query); setQuery(''); setSuggestions([]); } }} placeholder="Поиск" className="p-2 rounded bg-[#11161f] border border-neutral-700 w-full" />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-[#1E222B] border border-neutral-700 rounded">
              {suggestions.map((p) => (
                <div key={p.id} className="px-3 py-2 hover:bg-[#2a2f3a] cursor-pointer" onClick={() => { addByName(p.name); setQuery(''); setSuggestions([]); }}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="text-neutral-400">
            <tr>
              <th className="text-left p-2">Товар</th>
              <th className="text-left p-2">Цена</th>
              <th className="text-left p-2">Кол-во</th>
              <th className="text-left p-2">Сумма</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((i) => (
              <tr key={i.product.id} className="border-t border-neutral-800">
                <td className="p-2">{i.product.name}</td>
                <td className="p-2">{formatUZS(i.unitPrice)}</td>
                <td className="p-2 flex items-center gap-2">
                  <button className="btn" onClick={() => dec(i.product.id)}>-</button>
                  <div>{i.quantity}</div>
                  <button className="btn" onClick={() => inc(i.product.id)}>+</button>
                </td>
                <td className="p-2">{formatUZS(i.unitPrice * i.quantity)}</td>
                <td className="p-2 text-right"><button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => del(i.product.id)}>Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2">
          <label>Скидка</label>
          <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="p-2 rounded bg-[#11161f] border border-neutral-700 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <label>Оплата</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as '' | 'cash' | 'card')} className="p-2 rounded bg-[#11161f] border border-neutral-700">
            <option value="">Не выбрано</option>
            <option value="cash">Наличные</option>
            <option value="card">Карта</option>
          </select>
        </div>
        <div className="text-xl">Итого: {formatUZS(Math.max(0, total - discount))}</div>
        <div className="flex gap-2 ml-auto">
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => setScannerOpen(true)}>Сканировать штрих-код</button>
          <button className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]" onClick={() => setCart([])} disabled={!cart.length}>Очистить</button>
          <button className="btn" onClick={pay} disabled={!cart.length}>Оплатить</button>
        </div>
      </div>

      <ScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={(code) => { addByName(code); setScannerOpen(false); }} />
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}

//



