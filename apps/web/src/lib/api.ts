export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    // пробуем вытащить сообщение из JSON
    let message = 'Request failed';
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        message = (data && (data.message || data.error)) || message;
      } catch {}
    } else {
      try { message = await res.text(); } catch {}
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export type User = { id: number; username?: string; role: 'ADMIN' | 'STAFF' };
export async function getMe() {
  return apiFetch<User>('/api/me');
}



