import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

type Phone = {
  id: number;
  imei: string;
  model: string;
  purchasePrice: number | string;
  condition: 'new' | 'used';
  salePrice?: number | string | null;
  status: 'in_stock' | 'sold';
};

export default function SalesNew() {
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [salePrice, setSalePrice] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | ''>('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [initialPayment, setInitialPayment] = useState<number | ''>('');
  const [creditMonths, setCreditMonths] = useState<number>(6);
  const [loading, setLoading] = useState(false);

  async function loadPhones() {
    try {
      const res = await apiFetch<{ items: Phone[] }>('/api/phones?status=in_stock&limit=1000');
      setPhones(res.items);
    } catch (error) {
      console.error('Не удалось загрузить телефоны', error);
      setPhones([]);
    }
  }

  useEffect(() => {
    loadPhones();
  }, []);

  const filteredPhones = useMemo(() => {
    if (!searchQuery.trim()) return phones;
    const query = searchQuery.toLowerCase();
    return phones.filter(
      (p) =>
        p.imei.toLowerCase().includes(query) ||
        p.model.toLowerCase().includes(query)
    );
  }, [phones, searchQuery]);

  function selectPhone(phone: Phone) {
    setSelectedPhone(phone);
    setSalePrice(phone.salePrice ? Number(phone.salePrice) : '');
    setPaymentMethod('');
    setCustomerFirstName('');
    setCustomerLastName('');
    setInitialPayment('');
    setCreditMonths(6);
  }

  function clearSelection() {
    setSelectedPhone(null);
    setSalePrice('');
    setPaymentMethod('');
    setCustomerFirstName('');
    setCustomerLastName('');
    setInitialPayment('');
    setCreditMonths(6);
  }

  const monthlyPayment = useMemo(() => {
    if (paymentMethod !== 'credit' || !salePrice || !initialPayment || !creditMonths) return null;
    const remaining = Number(salePrice) - Number(initialPayment);
    return remaining / creditMonths;
  }, [paymentMethod, salePrice, initialPayment, creditMonths]);

  async function completeSale() {
    if (!selectedPhone) {
      toast.error('Выберите телефон');
      return;
    }
    if (!salePrice) {
      toast.error('Укажите цену продажи');
      return;
    }
    if (!paymentMethod) {
      toast.error('Выберите способ оплаты');
      return;
    }
    if (paymentMethod === 'credit') {
      if (!initialPayment || Number(initialPayment) >= Number(salePrice)) {
        toast.error('Первоначальный платёж должен быть меньше цены продажи');
        return;
      }
      if (!customerFirstName || !customerLastName) {
        toast.error('Укажите имя и фамилию покупателя для кредита');
        return;
      }
      if (!creditMonths || creditMonths < 1) {
        toast.error('Укажите период кредитования');
        return;
      }
    }

    setLoading(true);
    try {
      await apiFetch('/api/sales/phone', {
        method: 'POST',
        body: JSON.stringify({
          phoneId: selectedPhone.id,
          salePrice: Number(salePrice),
          paymentMethod,
          customerFirstName: customerFirstName || undefined,
          customerLastName: customerLastName || undefined,
          initialPayment: initialPayment ? Number(initialPayment) : undefined,
          creditMonths: paymentMethod === 'credit' ? creditMonths : undefined,
        }),
      });
      toast.success('Продажа оформлена');
      clearSelection();
      await loadPhones();
    } catch (e: any) {
      toast.error(e.message || 'Не удалось оформить продажу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Новая продажа</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Левая колонка: выбор телефона */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-medium mb-3">Выбор телефона</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по IMEI или модели"
              className="w-full p-2 rounded bg-[#11161f] border border-neutral-700 mb-3"
            />
            <div className="overflow-auto max-h-96 border border-neutral-800 rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">IMEI</th>
                    <th className="text-left p-2">Модель</th>
                    <th className="text-left p-2">Состояние</th>
                    <th className="text-left p-2">Цена покупки</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPhones.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-neutral-500">
                        {searchQuery ? 'Телефоны не найдены' : 'Нет телефонов в наличии'}
                      </td>
                    </tr>
                  ) : (
                    filteredPhones.map((phone) => (
                      <tr
                        key={phone.id}
                        className={`border-t border-neutral-800 cursor-pointer hover:bg-[#1a1f29] ${
                          selectedPhone?.id === phone.id ? 'bg-[#1a1f29]' : ''
                        }`}
                        onClick={() => selectPhone(phone)}
                      >
                        <td className="p-2">{phone.imei}</td>
                        <td className="p-2">{phone.model}</td>
                        <td className="p-2">{phone.condition === 'new' ? 'Новый' : 'Б.у.'}</td>
                        <td className="p-2">{formatUZS(Number(phone.purchasePrice))}</td>
                        <td className="p-2">
                          {selectedPhone?.id === phone.id && <span className="text-green-500">✓</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Правая колонка: форма продажи */}
        <div className="space-y-4">
          {selectedPhone ? (
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Информация о телефоне</h2>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] text-sm"
                >
                  Отменить
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-400">IMEI:</span> <span className="ml-2">{selectedPhone.imei}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Модель:</span> <span className="ml-2">{selectedPhone.model}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Состояние:</span>{' '}
                  <span className="ml-2">{selectedPhone.condition === 'new' ? 'Новый' : 'Б.у.'}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Цена покупки:</span>{' '}
                  <span className="ml-2">{formatUZS(Number(selectedPhone.purchasePrice))}</span>
                </div>
                {selectedPhone.salePrice && (
                  <div>
                    <span className="text-neutral-400">Предложенная цена продажи:</span>{' '}
                    <span className="ml-2">{formatUZS(Number(selectedPhone.salePrice))}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-800 pt-4 space-y-3">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Цена продажи *</label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Укажите цену продажи"
                    className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Способ оплаты *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as 'cash' | 'card' | 'credit' | '');
                      if (e.target.value !== 'credit') {
                        setCustomerFirstName('');
                        setCustomerLastName('');
                        setInitialPayment('');
                      }
                    }}
                    className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                  >
                    <option value="">Выберите способ оплаты</option>
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                    <option value="credit">Кредит (насия)</option>
                  </select>
                </div>

                {paymentMethod === 'credit' && (
                  <>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Имя покупателя *</label>
                      <input
                        type="text"
                        value={customerFirstName}
                        onChange={(e) => setCustomerFirstName(e.target.value)}
                        placeholder="Имя"
                        className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Фамилия покупателя *</label>
                      <input
                        type="text"
                        value={customerLastName}
                        onChange={(e) => setCustomerLastName(e.target.value)}
                        placeholder="Фамилия"
                        className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Первоначальный платёж *</label>
                      <input
                        type="number"
                        value={initialPayment}
                        onChange={(e) => setInitialPayment(e.target.value ? Number(e.target.value) : '')}
                        placeholder="Сумма первоначального платежа"
                        className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Период кредитования (месяцев) *</label>
                      <select
                        value={creditMonths}
                        onChange={(e) => setCreditMonths(Number(e.target.value))}
                        className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                      >
                        <option value={3}>3 месяца</option>
                        <option value={6}>6 месяцев</option>
                        <option value={9}>9 месяцев</option>
                        <option value={12}>12 месяцев</option>
                      </select>
                    </div>
                    {monthlyPayment !== null && (
                      <div className="p-3 rounded bg-[#1a1f29] border border-neutral-700">
                        <div className="text-sm text-neutral-400">Ежемесячный платёж ({creditMonths} месяцев):</div>
                        <div className="text-lg font-semibold">{formatUZS(monthlyPayment)}</div>
                      </div>
                    )}
                  </>
                )}

                {(paymentMethod === 'cash' || paymentMethod === 'card') && (
                  <div className="p-3 rounded bg-[#1a1f29] border border-neutral-700">
                    <div className="text-sm text-neutral-400">Итого к оплате:</div>
                    <div className="text-lg font-semibold">{salePrice ? formatUZS(Number(salePrice)) : '—'}</div>
                  </div>
                )}

                <button className="btn w-full" onClick={completeSale} disabled={loading}>
                  {loading ? 'Оформление...' : 'Оформить продажу'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <div className="text-center text-neutral-500">Выберите телефон для продажи</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
