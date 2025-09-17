import { sendMonthlyReport } from './telegram';

// Функция для проверки, нужно ли отправить ежемесячный отчёт
export function checkAndSendMonthlyReport() {
  const now = new Date();
  const today = now.getDate();
  
  // Отправляем отчёт 1 числа каждого месяца в 9:00
  if (today === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
    console.log('[scheduler] Отправляем ежемесячный отчёт...');
    sendMonthlyReport().catch(error => {
      console.error('[scheduler] Ошибка отправки ежемесячного отчёта:', error);
    });
  }
}

// Запускаем проверку каждую минуту
export function startScheduler() {
  console.log('[scheduler] Планировщик задач запущен');
  
  // Проверяем сразу при запуске
  checkAndSendMonthlyReport();
  
  // Затем каждую минуту
  setInterval(checkAndSendMonthlyReport, 60 * 1000);
}
