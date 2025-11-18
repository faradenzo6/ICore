import React from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../store/auth';

// Разрешаем адреса вида admin@local (без TLD)
const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { fetch } = useAuth();
  const redirectTo = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const target = params.get('redirectTo');
    if (target && target.startsWith('/')) return target;
    return '/sales/new';
  }, [location.search]);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setFocus } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [formError, setFormError] = React.useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      const response = await apiFetch<{ id: number; username: string; role: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('[login] Успешный вход, ответ:', response);
      // Обновляем состояние пользователя
      await fetch();
      // Перенаправляем на нужную страницу
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : '';
      if (message) {
        setFormError(message);
      } else {
        toast.error('Ошибка входа');
      }
      setFocus('login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="card p-6 w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-4">Вход</h1>
        <label className="block mb-2">Логин или Email</label>
        <input className="w-full mb-1 p-2 rounded bg-[#11161f] border border-neutral-700" type="text" {...register('login')} />
        {errors.login && <p className="text-red-400 text-sm mb-2">{errors.login.message}</p>}
        <label className="block mb-2 mt-2">Пароль</label>
        <input className="w-full mb-1 p-2 rounded bg-[#11161f] border border-neutral-700" type="password" {...register('password')} />
        {errors.password && <p className="text-red-400 text-sm mb-2">{errors.password.message}</p>}
        <button className="btn w-full mt-4" disabled={isSubmitting}>{isSubmitting ? '...' : 'Войти'}</button>
        {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
      </form>
    </div>
  );
}



