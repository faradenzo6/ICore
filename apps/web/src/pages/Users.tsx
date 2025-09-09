import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type User = { id: number; username?: string; role: 'ADMIN'|'STAFF_MANAGER'|'STAFF'; createdAt: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('STAFF');

  async function load() {
    const data = await apiFetch<User[]>('/api/users');
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
    setUsername(''); setPassword(''); setRole('STAFF');
    await load();
  }

  async function updateRole(id: number, role: User['role']) {
    await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) });
    await load();
  }

  async function resetPassword(id: number) {
    const p = prompt('Новый пароль:');
    if (!p) return;
    await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ password: p }) });
    alert('Пароль обновлён');
  }

  async function remove(id: number) {
    if (!confirm('Удалить пользователя?')) return;
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    await load();
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
                  <button className="btn" onClick={() => resetPassword(u.id)}>Сброс пароля</button>
                  <button className="btn" onClick={() => remove(u.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


