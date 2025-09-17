import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';

type User = { id: number; username?: string; role: 'ADMIN'|'STAFF_MANAGER'|'STAFF'; createdAt: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('STAFF');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function load() {
    const data = await apiFetch<User[]>('/api/users');
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  const deleteUserLabel = userToDelete ? userToDelete.username || `ID ${userToDelete.id}` : '';

  async function createUser() {
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
      setUsername(''); setPassword(''); setRole('STAFF');
      await load();
      toast.success('Пользователь создан');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось создать пользователя');
    }
  }

  async function updateRole(id: number, role: User['role']) {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) });
      await load();
      toast.success('Роль обновлена');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось обновить роль');
    }
  }

  function startResetPassword(user: User) {
    setResetUser(user);
    setResetPasswordValue('');
  }

  function closeResetModal() {
    if (resetLoading) return;
    setResetUser(null);
    setResetPasswordValue('');
  }

  async function submitResetPassword() {
    if (!resetUser) return;
    if (!resetPasswordValue.trim()) return;
    setResetLoading(true);
    try {
      await apiFetch(`/api/users/${resetUser.id}`, { method: 'PUT', body: JSON.stringify({ password: resetPasswordValue }) });
      toast.success('Пароль обновлён');
      setResetUser(null);
      setResetPasswordValue('');
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось обновить пароль');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
      toast.success('Пользователь удалён');
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Не удалось удалить пользователя');
    } finally {
      setDeleteLoading(false);
      setUserToDelete(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Пользователи</h1>
      <div className="card p-4 grid gap-2 md:grid-cols-4">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Логин" className="p-2 rounded bg-[#11161f] border border-neutral-700" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" className="p-2 rounded bg-[#11161f] border border-neutral-700" />
        <select value={role} onChange={(e) => setRole(e.target.value as User['role'])} className="p-2 rounded bg-[#11161f] border border-neutral-700">
          <option value="ADMIN">Администратор</option>
          <option value="STAFF">Сотрудник</option>
        </select>
        <button className="btn" onClick={createUser}>Создать</button>
      </div>

      <div className="card overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-neutral-400">
            <tr>
              <th className="text-left p-2">Логин</th>
              <th className="text-left p-2">Роль</th>
              <th className="text-left p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-800">
                <td className="p-2">{u.username || ''}</td>
                <td className="p-2">
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as User['role'])} className="p-1 rounded bg-[#11161f] border border-neutral-700">
                    <option value="ADMIN">Администратор</option>
                    <option value="STAFF">Сотрудник</option>
                  </select>
                </td>
                <td className="p-2 flex gap-2">
                  <button className="btn" onClick={() => startResetPassword(u)}>Сброс пароля</button>
                  <button className="btn" onClick={() => setUserToDelete(u)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Удалить пользователя"
        description={userToDelete ? `Удалить пользователя «${deleteUserLabel}»?` : undefined}
        confirmText="Удалить"
        onConfirm={handleDeleteUser}
        onClose={() => { if (!deleteLoading) setUserToDelete(null); }}
        loading={deleteLoading}
        destructive
      />

      {resetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={closeResetModal}
        >
          <div
            className="card w-full max-w-sm p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Сброс пароля</div>
              <button className="text-neutral-300" onClick={closeResetModal}>✕</button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-neutral-300">
                Новый пароль для пользователя «{resetUser.username || `ID ${resetUser.id}`}».
              </div>
              <input
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Новый пароль"
                className="w-full rounded border border-neutral-700 bg-[#11161f] p-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]"
                  onClick={closeResetModal}
                  disabled={resetLoading}
                >
                  Отмена
                </button>
                <button
                  className="btn"
                  onClick={submitResetPassword}
                  disabled={resetLoading || !resetPasswordValue.trim()}
                >
                  {resetLoading ? '...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


