import { useEffect, useRef } from 'react';

export function useAutoRefresh(callback: () => void, intervalMs: number = 30000) {
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Обновляем ссылку на callback при каждом рендере
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Очищаем предыдущий интервал
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Создаем новый интервал
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    // Очистка при размонтировании
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMs]);

  // Функция для ручного обновления
  const refresh = () => {
    callbackRef.current();
  };

  return { refresh };
}
