import { create } from 'zustand';
import { getMe, User } from '../lib/api';

type AuthState = {
  user: User | null;
  loading: boolean;
  fetch: () => Promise<void>;
  logout: () => Promise<void>;
};

let fetchPromise: Promise<void> | null = null;
let lastFetchTime = 0;
const FETCH_COOLDOWN = 5000; // 5 секунд между запросами
let isInitialized = false;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  fetch: async () => {
    const state = get();
    const now = Date.now();
    
    // Если пользователь уже загружен и прошло мало времени, не делаем запрос
    if (state.user && (now - lastFetchTime) < FETCH_COOLDOWN) {
      set({ loading: false });
      return;
    }
    
    // Если уже инициализировали и пользователь есть, не делаем повторный запрос
    if (isInitialized && state.user) {
      set({ loading: false });
      return;
    }
    
    // Если уже загружается, ждём завершения текущего запроса
    if (fetchPromise) {
      await fetchPromise;
      return;
    }
    
    fetchPromise = (async () => {
      set({ loading: true });
      try {
        const u = await getMe();
        lastFetchTime = Date.now();
        isInitialized = true;
        set({ user: u, loading: false });
      } catch (err) {
        console.error('[auth] Ошибка получения пользователя:', err);
        isInitialized = true;
        set({ user: null, loading: false });
      } finally {
        fetchPromise = null;
      }
    })();
    await fetchPromise;
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    set({ user: null, loading: false });
    fetchPromise = null;
    lastFetchTime = 0;
    isInitialized = false;
    location.href = '/login';
  },
}));


