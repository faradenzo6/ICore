import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getMe, User } from '../lib/api';
import { toast } from 'sonner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import ConfirmDialog from '../components/ConfirmDialog';

type Category = { id: number; name: string };
type Product = {
  id: number;
  name: string;
  sku: string;
  categoryId: number | null;
  price: number | null;
  costPrice: number | null;
  stock: number | null;
  isActive: boolean;
  category?: { id: number; name: string };
};

export default function Products() {
  const [me, setMe] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<{ items: Product[]; total: number; page: number; limit: number } | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState('all');
  const [limit, setLimit] = useState(20);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    apiFetch<Category[]>('/api/categories').then(setCategories);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (category) qs.set('category', String(category));
      if (active !== 'all') qs.set('active', String(active === 'true'));
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number } | null>('/api/products?' + qs.toString());

      if (res && search) {
        const filtered = res.items.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase())
        );
        setItems({ ...res, items: filtered });
      } else {
        setItems(res);
      }
    } catch (error) {
      console.error('Не удалось загрузить товары', error);
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [active, category, limit, page, search]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Автоматическое обновление каждые 30 секунд
  useAutoRefresh(() => {
    void loadProducts();
  }, 30000);

  const canCreate = me?.role === 'ADMIN';
  const columnCount = canCreate ? 8 : 7;

  async function handleDeleteProduct() {
    if (!productToDelete) return;
    setDeleteLoading(true);
    const target = productToDelete;
    setItems((prev) => prev ? { ...prev, items: prev.items.filter((x) => x.id !== target.id), total: Math.max(0, prev.total - 1) } : prev);
    try {
      await apiFetch(`/api/products/${target.id}`, { method: 'DELETE' });
      toast.success('Удалено');
    } catch (e) {
      const msg = (e as Error).message || 'Ошибка удаления';
      toast.error(msg);
      setPage(1);
      await loadProducts();
    } finally {
      setDeleteLoading(false);
      setProductToDelete(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Товары</h1>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Поиск по названию" className="p-2 rounded bg-[#11161f] border border-neutral-700 w-80" />
        <select value={category} onChange={(e) => { setCategory(e.target.value ? Number(e.target.value) : ''); setPage(1); }} className="p-2 rounded bg-[#11161f] border border-neutral-700">
          <option value="">Все категории</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="p-2 rounded bg-[#11161f] border border-neutral-700">
          <option value="all">Все</option>
          <option value="true">Активные</option>
          <option value="false">Скрытые</option>
        </select>
        <select value={String(limit)} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="p-2 rounded bg-[#11161f] border border-neutral-700">
          <option value="10">10 на странице</option>
          <option value="20">20 на странице</option>
          <option value="50">50 на странице</option>
          <option value="100">100 на странице</option>
        </select>
        {/* Кнопки справа после селектов */}
        <div className="flex gap-2 ml-auto">
          {canCreate && <CreateProduct onCreated={() => { setPage(1); void loadProducts(); }} categories={categories} />}
          {canCreate && <ManageCategories />}
        </div>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#121822] text-neutral-300 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Название</th>
              <th className="text-left p-2">Категория</th>
              <th className="text-left p-2">Цена продажи</th>
              <th className="text-left p-2">Себестоимость</th>
              <th className="text-left p-2">Остаток</th>
              <th className="text-left p-2">Статус</th>
              {canCreate && <th className="text-left p-2">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-4 text-center text-neutral-400" colSpan={columnCount}>Загрузка...</td>
              </tr>
            )}
            {items?.items.map((p) => (
              <tr key={p.id} className="border-t border-neutral-800">
                <td className="p-2">{p.id}</td>
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.category?.name || ''}</td>
                <td className="p-2">{p.price != null ? formatUZS(p.price) : '—'}</td>
                <td className="p-2">{p.costPrice != null ? formatUZS(p.costPrice) : '—'}</td>
                <td className="p-2">{p.stock != null ? p.stock : '—'}</td>
                <td className="p-2">{p.isActive ? 'Активен' : 'Скрыт'}</td>
                {canCreate && (
                  <td className="p-2 space-x-2">
                    <EditProduct product={p} categories={categories} onUpdated={() => { setPage(1); void loadProducts(); }} />
                    <button className="btn" onClick={() => setProductToDelete(p)}>Удалить</button>
                  </td>
                )}
              </tr>
            ))}
            {items && items.items.length === 0 && !loading && (
              <tr>
                <td className="p-4 text-center text-neutral-400" colSpan={columnCount}>Нет товаров</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items && (
        <div className="flex gap-4 items-center">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
          <div>Стр. {page} из {Math.ceil(items.total / items.limit)}</div>
          <button className="btn" disabled={page >= Math.ceil(items.total / items.limit)} onClick={() => setPage((p) => p + 1)}>Вперёд</button>
          <div className="text-sm text-neutral-400">
            Показано {items.items.length ? (items.page - 1) * items.limit + 1 : 0}
            –{Math.min(items.page * items.limit, items.total)} из {items.total}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(productToDelete)}
        title="Удалить товар"
        description={productToDelete ? `Вы уверены, что хотите удалить товар «${productToDelete.name}»?` : undefined}
        confirmText="Удалить"
        onConfirm={handleDeleteProduct}
        onClose={() => { if (!deleteLoading) setProductToDelete(null); }}
        loading={deleteLoading}
        destructive
      />
    </div>
  );
}

function CreateProduct({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [sausagesPerUnit, setSausagesPerUnit] = useState<number | ''>('');
  const [bunId, setBunId] = useState<number | ''>('');
  const [sausageId, setSausageId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const isHotDog = useMemo(() => categories.find((c) => c.id === categoryId)?.name === 'Хот-Дог', [categories, categoryId]);
  const canSubmit = useMemo(() => {
    if (!name) return false;
    if (isHotDog) return Boolean(price !== '' && sausagesPerUnit !== '' && categoryId && bunId && sausageId);
    return true;
  }, [name, isHotDog, price, sausagesPerUnit, categoryId, bunId, sausageId]);

  async function submit() {
    setLoading(true);
    try {
      if (isHotDog) {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({ name, categoryId, isActive: true, price: Number(price), isComposite: true, sausagesPerUnit: Number(sausagesPerUnit), bunComponentId: bunId, sausageComponentId: sausageId }),
        });
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({ name, categoryId: categoryId || undefined, isActive: true }),
        });
      }
      setOpen(false);
      setName(''); setCategoryId(''); setPrice(''); setSausagesPerUnit(''); setBunId(''); setSausageId('');
      onCreated();
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось создать товар');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await apiFetch<{ items: Product[]; total: number; page: number; limit: number } | null>('/api/products?page=1&limit=1000');
      setAllProducts(res?.items || []);
    })();
  }, [open]);

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Новый товар</button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Создать товар</div>
              <button onClick={() => setOpen(false)} className="text-neutral-300">✕</button>
            </div>
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
              {/* Код генерируется автоматически на бэкенде */}
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700">
                <option value="">Без категории</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {isHotDog && (
                <>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')} placeholder="Цена продажи" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
                  <input type="number" value={sausagesPerUnit} onChange={(e) => setSausagesPerUnit(e.target.value ? Number(e.target.value) : '')} placeholder="Кол-во сосисок на единицу" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
                  <select value={bunId} onChange={(e) => setBunId(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700">
                    <option value="">Выберите лепёшки (компонент)</option>
                    {allProducts.filter((p) => p.name.toLowerCase().includes('лепёш')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={sausageId} onChange={(e) => setSausageId(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700">
                    <option value="">Выберите сосиски (компонент)</option>
                    {allProducts.filter((p) => p.name.toLowerCase().includes('сосиск')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="text-xs text-neutral-400">Склад пополняем только лепёшками и сосисками; стоимость компонентов в прибыль не входит.</div>
                </>
              )}
              {/* Настройки для составного товара (Хот-Дог) можно добавить позже отдельной формой */}
              {/* Цены управляются через раздел Склад */}
              <div className="flex gap-2 justify-end">
                <button className="btn" disabled={!canSubmit || loading} onClick={submit}>{loading ? '...' : 'Создать'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditProduct({ product, categories, onUpdated }: { product: Product; categories: Category[]; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [categoryId, setCategoryId] = useState<number | ''>(product.categoryId ?? '');
  const [isActive, setIsActive] = useState<boolean>(product.isActive);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean(name && sku), [name, sku]);

  async function submit() {
    setLoading(true);
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, sku, categoryId: categoryId || null, isActive }),
      });
      setOpen(false);
      onUpdated();
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось обновить товар');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Редактировать</button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Редактировать товар</div>
              <button onClick={() => setOpen(false)} className="text-neutral-300">✕</button>
            </div>
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
              <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Код" className="w-full p-2 rounded bg-[#11161f] border border-neutral-700" />
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 rounded bg-[#11161f] border border-neutral-700">
                <option value="">Без категории</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* Цены управляются через раздел Склад */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Активен
              </label>
              <div className="flex gap-2 justify-end">
                <button className="btn" disabled={!canSubmit || loading} onClick={submit}>{loading ? '...' : 'Сохранить'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ManageCategories() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: number; name: string } | null>(null);
  const [categoryDeleting, setCategoryDeleting] = useState(false);

  async function load() {
    const data = await apiFetch<{ id: number; name: string }[]>('/api/categories');
    setItems(data);
  }

  async function add() {
    if (!name.trim()) return;
    try {
      await apiFetch('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
      toast.success('Категория добавлена');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось добавить категорию');
    }
  }

  async function handleDeleteCategory() {
    if (!categoryToDelete) return;
    setCategoryDeleting(true);
    try {
      await apiFetch(`/api/categories/${categoryToDelete.id}`, { method: 'DELETE' });
      toast.success('Категория удалена');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось удалить категорию');
    } finally {
      setCategoryDeleting(false);
      setCategoryToDelete(null);
    }
  }

  return (
    <>
      <button className="btn" onClick={() => { setOpen(true); load(); }}>Категории</button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="card p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Категории</div>
              <button onClick={() => setOpen(false)} className="text-neutral-300">✕</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название категории" className="flex-1 p-2 rounded bg-[#11161f] border border-neutral-700" />
                <button className="btn" onClick={add}>Добавить</button>
              </div>
              <div className="max-h-64 overflow-auto border border-neutral-800 rounded">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                    <div>{c.name}</div>
                    <button className="btn" onClick={() => setCategoryToDelete(c)}>Удалить</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(categoryToDelete)}
        title="Удалить категорию"
        description={categoryToDelete ? `Удалить категорию «${categoryToDelete.name}»?` : undefined}
        confirmText="Удалить"
        onConfirm={handleDeleteCategory}
        onClose={() => { if (!categoryDeleting) setCategoryToDelete(null); }}
        loading={categoryDeleting}
        destructive
      />
    </>
  );
}


function formatUZS(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
}



