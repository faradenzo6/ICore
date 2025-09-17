import { fetch, Agent, ProxyAgent } from 'undici';

const HTTPS_PROXY = process.env.HTTPS_PROXY;

export const dispatcher =
  HTTPS_PROXY
    ? new ProxyAgent(HTTPS_PROXY)                // прокси включён
    : new Agent({ connect: { family: 4, timeout: 4000 } }); // без прокси, IPv4

// Функция для HTTP POST запросов
export async function httpPost(url: string, body: any) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    dispatcher,            // ВАЖНО: прокинуть dispatcher
  });
}

// Функция для HTTP GET запросов
export async function httpGet(url: string) {
  return fetch(url, {
    method: 'GET',
    dispatcher,
  });
}

// Экспортируем fetch с настроенным dispatcher для прямого использования
export { fetch };
