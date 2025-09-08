import { create } from 'zustand';
import { getMe, User } from '../lib/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  fetch: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetch: async () => {
    try {
      const u = await getMe();
      set({ user: u, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.href = '/login';
  },
}));


