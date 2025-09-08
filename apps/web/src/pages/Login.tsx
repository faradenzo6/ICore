import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

// Разрешаем адреса вида admin@local (без TLD)
const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      location.href = '/sales/new';
    } else {
      toast.error('Ошибка входа');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="card p-6 w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-4">Вход</h1>
        <label className="block mb-2">Логин или Email</label>
        <input className="w-full mb-1 p-2 rounded bg-[#11161f] border border-neutral-700" type="text" {...register('login')} />
        <label className="block mb-2 mt-2">Пароль</label>
        <input className="w-full mb-1 p-2 rounded bg-[#11161f] border border-neutral-700" type="password" {...register('password')} />
        {errors.password && <p className="text-red-400 text-sm mb-2">{errors.password.message}</p>}
        <button className="btn w-full mt-4" disabled={isSubmitting}>{isSubmitting ? '...' : 'Войти'}</button>
      </form>
    </div>
  );
}



