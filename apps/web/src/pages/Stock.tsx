import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { toast } from 'sonner';

type Phone = {
  id: number;
  imei: string;
  model: string;
  purchasePrice: number | string;
  condition: 'new' | 'used';
  salePrice?: number | string | null;
  status: 'in_stock' | 'sold';
  createdAt: string;
};

type PhoneMovement = {
  id: number;
  phone: Phone;
  type: string;
  purchasePrice?: number | string | null;
  salePrice?: number | string | null;
  note?: string | null;
  createdAt: string;
  user?: { username: string };
};

export default function StockPage() {
  const [imei, setImei] = useState('');
  const [model, setModel] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [salePrice, setSalePrice] = useState<number | ''>('');

  const [phonesInStock, setPhonesInStock] = useState<Phone[]>([]);
  const [movements, setMovements] = useState<PhoneMovement[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  async function addPhone() {
    if (!imei.trim() || !model.trim() || !purchasePrice) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/phones', {
        method: 'POST',
        body: JSON.stringify({
          imei: imei.trim(),
          model: model.trim(),
          purchasePrice: Number(purchasePrice),
          condition,
          salePrice: salePrice || undefined,
        }),
      });
      toast.success('Телефон добавлен на склад');
      setImei('');
      setModel('');
      setPurchasePrice('');
      setCondition('new');
      setSalePrice('');
      await loadPhonesInStock();
      await loadMovements();
    } catch (e: any) {
      toast.error(e.message || 'Не удалось добавить телефон');
    } finally {
      setLoading(false);
    }
  }

  async function loadPhonesInStock() {
    try {
      const res = await apiFetch<{ items: Phone[]; total: number }>('/api/phones?status=in_stock&limit=1000');
      setPhonesInStock(res.items);
    } catch (error) {
      console.error('Не удалось загрузить телефоны', error);
      setPhonesInStock([]);
    }
  }

  async function loadMovements() {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (type) qs.set('type', type);
    qs.set('page', String(historyPage));
    qs.set('limit', String(historyLimit));
    try {
      const data = await apiFetch<{ items: PhoneMovement[]; total: number; page: number; limit: number }>(
        `/api/phones/movements/history?${qs.toString()}`
      );
      setMovements(data.items);
      setHistoryTotal(data.total);
    } catch (error) {
      console.error('Не удалось загрузить историю', error);
      setMovements([]);
    }
  }

  useEffect(() => {
    loadPhonesInStock();
    loadMovements();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [historyPage, from, to, type]);

  // Автоматическое обновление каждые 30 секунд
  useAutoRefresh(() => {
    loadPhonesInStock();
    loadMovements();
  }, 30000);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Склад</h1>

      {/* Форма добавления телефона */}
      <div className="card p-4 grid gap-3 md:grid-cols-6 items-end">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">IMEI *</label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="IMEI телефона"
            className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Модель *</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Модель телефона"
            className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Цена покупки *</label>
          <input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : '')}
            placeholder="Сумма покупки"
            className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Состояние *</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as 'new' | 'used')}
            className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
          >
            <option value="new">Новый</option>
            <option value="used">Б.у.</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Цена продажи</label>
          <input
            type="number"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : '')}
            placeholder="Опционально"
            className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
          />
        </div>
        <div className="flex items-end">
          <button className="btn w-full" onClick={addPhone} disabled={loading}>
            {loading ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>

      {/* Телефоны в наличии */}
      <div className="card p-4">
        <div className="font-medium mb-2">Телефоны в наличии</div>
        <div className="overflow-auto max-h-64 border border-neutral-800 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2">IMEI</th>
                <th className="text-left p-2">Модель</th>
                <th className="text-left p-2">Состояние</th>
                <th className="text-left p-2">Цена покупки</th>
                <th className="text-left p-2">Цена продажи</th>
                <th className="text-left p-2">Дата добавления</th>
              </tr>
            </thead>
            <tbody>
              {phonesInStock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-neutral-500">
                    Нет телефонов в наличии
                  </td>
                </tr>
              ) : (
                phonesInStock.map((phone) => (
                  <tr key={phone.id} className="border-t border-neutral-800">
                    <td className="p-2">{phone.imei}</td>
                    <td className="p-2">{phone.model}</td>
                    <td className="p-2">{phone.condition === 'new' ? 'Новый' : 'Б.у.'}</td>
                    <td className="p-2">{formatUZS(Number(phone.purchasePrice))}</td>
                    <td className="p-2">{phone.salePrice ? formatUZS(Number(phone.salePrice)) : '—'}</td>
                    <td className="p-2">{new Date(phone.createdAt).toLocaleDateString('ru-RU')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* История движений */}
      <div className="card p-4 space-y-3">
        <div className="font-medium">История</div>
        <div className="flex flex-wrap gap-2 items-end">
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
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Операция</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="p-2 rounded bg-[#11161f] border border-neutral-700"
            >
              <option value="">Все</option>
              <option value="IN">Поступление</option>
              <option value="SALE">Продажа</option>
            </select>
          </div>
          <button
            className="btn"
            onClick={() => {
              setHistoryPage(1);
              loadMovements();
            }}
          >
            Показать
          </button>
          <button
            className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]"
            onClick={() => {
              setFrom('');
              setTo('');
              setType('');
              setHistoryPage(1);
              loadMovements();
            }}
          >
            Сбросить
          </button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2">Дата</th>
                <th className="text-left p-2">IMEI</th>
                <th className="text-left p-2">Модель</th>
                <th className="text-left p-2">Операция</th>
                <th className="text-left p-2">Цена покупки</th>
                <th className="text-left p-2">Цена продажи</th>
                <th className="text-left p-2">Чистая прибыль</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-neutral-500">
                    Нет записей
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-t border-neutral-800">
                    <td className="p-2">{new Date(m.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="p-2">{m.phone.imei}</td>
                    <td className="p-2">{m.phone.model}</td>
                    <td className="p-2">{m.type === 'IN' ? 'Поступление' : 'Продажа'}</td>
                    <td className="p-2">{m.purchasePrice ? formatUZS(Number(m.purchasePrice)) : '—'}</td>
                    <td className="p-2">{m.salePrice ? formatUZS(Number(m.salePrice)) : '—'}</td>
                    <td className="p-2">
                      {m.type === 'SALE' && m.salePrice && m.purchasePrice
                        ? formatUZS(Number(m.salePrice) - Number(m.purchasePrice))
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация для истории */}
        {historyTotal > historyLimit && (
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <div className="text-sm text-neutral-400">
              Показано {((historyPage - 1) * historyLimit) + 1}-{Math.min(historyPage * historyLimit, historyTotal)} из{' '}
              {historyTotal}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={historyPage === 1}
              >
                Назад
              </button>
              <span className="px-3 py-1 text-sm">
                Страница {historyPage} из {Math.ceil(historyTotal / historyLimit)}
              </span>
              <button
                className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() =>
                  setHistoryPage((prev) => Math.min(Math.ceil(historyTotal / historyLimit), prev + 1))
                }
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
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
