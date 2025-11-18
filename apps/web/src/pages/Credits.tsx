import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

type Credit = {
  id: number;
  saleId: number;
  phone: {
    id: number;
    imei: string;
    model: string;
    condition: string;
  } | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  salePrice: number;
  purchasePrice: number;
  total: number;
  initialPayment: number;
  monthlyPayment: number;
  creditMonths: number;
  totalPaid: number;
  remaining: number;
  createdAt: string;
  payments: Array<{
    id: number;
    amount: number | string;
    note: string | null;
    createdAt: string;
    user: { username: string } | null;
  }>;
  soldBy: string | null;
};

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadCredits() {
    try {
      const data = await apiFetch<Credit[]>('/api/credits');
      setCredits(data);
    } catch (error) {
      console.error('Не удалось загрузить кредиты', error);
      setCredits([]);
    }
  }

  useEffect(() => {
    loadCredits();
  }, []);

  useAutoRefresh(() => {
    loadCredits();
  }, 30000);

  async function addPayment() {
    if (!selectedCredit) {
      toast.error('Выберите кредит');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Укажите сумму платежа');
      return;
    }
    if (Number(paymentAmount) > selectedCredit.remaining) {
      toast.error(`Сумма превышает остаток. Остаток: ${formatUZS(selectedCredit.remaining)}`);
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/credits/payment', {
        method: 'POST',
        body: JSON.stringify({
          saleId: selectedCredit.saleId,
          amount: Number(paymentAmount),
          note: paymentNote || undefined,
        }),
      });
      toast.success('Платёж внесён');
      setPaymentAmount('');
      setPaymentNote('');
      setSelectedCredit(null);
      await loadCredits();
    } catch (e: any) {
      toast.error(e.message || 'Не удалось внести платёж');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Кредиты</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Список кредитов */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="font-medium mb-3">Список кредитов</div>
            <div className="overflow-auto max-h-[calc(100vh-300px)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2">Клиент</th>
                    <th className="text-left p-2">Телефон</th>
                    <th className="text-left p-2">Сумма продажи</th>
                    <th className="text-left p-2">Первоначальный платёж</th>
                    <th className="text-left p-2">Оплачено</th>
                    <th className="text-left p-2">Остаток</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {credits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-neutral-500">
                        Нет кредитов
                      </td>
                    </tr>
                  ) : (
                    credits.map((credit) => {
                      const additionalPayments = credit.totalPaid - credit.initialPayment;
                      return (
                        <tr
                          key={credit.id}
                          className={`border-t border-neutral-800 cursor-pointer hover:bg-[#1a1f29] ${
                            selectedCredit?.id === credit.id ? 'bg-[#1a1f29]' : ''
                          }`}
                          onClick={() => setSelectedCredit(credit)}
                        >
                          <td className="p-2">
                            {credit.customerFirstName} {credit.customerLastName}
                          </td>
                          <td className="p-2">
                            {credit.phone ? (
                              <div>
                                <div>{credit.phone.model}</div>
                                <div className="text-xs text-neutral-500">IMEI: {credit.phone.imei}</div>
                                <div className="text-xs text-neutral-500">
                                  Себестоимость: {formatUZS(credit.purchasePrice)}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-2">{formatUZS(credit.total)}</td>
                          <td className="p-2">{formatUZS(credit.initialPayment)}</td>
                          <td className="p-2">{formatUZS(additionalPayments)}</td>
                          <td className="p-2">
                            <span className={credit.remaining > 0 ? 'text-red-400' : 'text-green-400'}>
                              {formatUZS(credit.remaining)}
                            </span>
                          </td>
                          <td className="p-2">
                            {selectedCredit?.id === credit.id && <span className="text-green-500">✓</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Форма внесения платежа */}
        <div className="space-y-4">
          {selectedCredit ? (
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Информация о кредите</h2>
                <button
                  onClick={() => {
                    setSelectedCredit(null);
                    setPaymentAmount('');
                    setPaymentNote('');
                  }}
                  className="px-3 py-1 rounded border border-neutral-700 hover:bg-[#242834] text-sm"
                >
                  Отменить
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-400">Клиент:</span>{' '}
                  <span className="ml-2">
                    {selectedCredit.customerFirstName} {selectedCredit.customerLastName}
                  </span>
                </div>
                {selectedCredit.phone && (
                  <>
                    <div>
                      <span className="text-neutral-400">Телефон:</span>{' '}
                      <span className="ml-2">{selectedCredit.phone.model}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">IMEI:</span>{' '}
                      <span className="ml-2">{selectedCredit.phone.imei}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Состояние:</span>{' '}
                      <span className="ml-2">{selectedCredit.phone.condition === 'new' ? 'Новый' : 'Б.у.'}</span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-neutral-400">Сумма продажи:</span>{' '}
                  <span className="ml-2">{formatUZS(selectedCredit.total)}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Себестоимость:</span>{' '}
                  <span className="ml-2">{formatUZS(selectedCredit.purchasePrice)}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Первоначальный платёж:</span>{' '}
                  <span className="ml-2">{formatUZS(selectedCredit.initialPayment)}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Ежемесячный платёж:</span>{' '}
                  <span className="ml-2">{formatUZS(selectedCredit.monthlyPayment)}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Период:</span>{' '}
                  <span className="ml-2">{selectedCredit.creditMonths} месяцев</span>
                </div>
                <div>
                  <span className="text-neutral-400">Оплачено:</span>{' '}
                  <span className="ml-2">{formatUZS(selectedCredit.totalPaid)}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Остаток:</span>{' '}
                  <span className={`ml-2 ${selectedCredit.remaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatUZS(selectedCredit.remaining)}
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-700">
                  <span className="text-neutral-400">Чистая прибыль (на данный момент):</span>{' '}
                  <span className={`ml-2 font-semibold ${selectedCredit.totalPaid - selectedCredit.purchasePrice >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatUZS(selectedCredit.totalPaid - selectedCredit.purchasePrice)}
                  </span>
                </div>
              </div>

              {selectedCredit.remaining > 0 && (
                <div className="border-t border-neutral-800 pt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Сумма платежа *</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                      placeholder={`Макс: ${formatUZS(selectedCredit.remaining)}`}
                      max={selectedCredit.remaining}
                      className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Примечание</label>
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Опционально"
                      className="w-full p-2 rounded bg-[#11161f] border border-neutral-700"
                    />
                  </div>
                  <button className="btn w-full" onClick={addPayment} disabled={loading}>
                    {loading ? 'Внесение...' : 'Внести платёж'}
                  </button>
                </div>
              )}

              {/* История платежей */}
              {selectedCredit.payments.length > 0 && (
                <div className="border-t border-neutral-800 pt-4">
                  <div className="text-sm font-medium mb-2">История платежей</div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {selectedCredit.payments.map((payment) => (
                      <div key={payment.id} className="text-xs p-2 rounded bg-[#1a1f29] border border-neutral-700">
                        <div className="flex justify-between">
                          <span>{formatUZS(Number(payment.amount))}</span>
                          <span className="text-neutral-500">
                            {new Date(payment.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        {payment.note && <div className="text-neutral-500 mt-1">{payment.note}</div>}
                        {payment.user && (
                          <div className="text-neutral-500 mt-1">Внёс: {payment.user.username}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-4">
              <div className="text-center text-neutral-500">Выберите кредит для внесения платежа</div>
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

