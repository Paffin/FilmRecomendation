import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null | void>) | null = null;
let refreshInFlight: Promise<string | null | void> | null = null;
const REFRESH_TIMEOUT_MS = 4500;
const MAX_REFRESH_ATTEMPTS = 2;
const REFRESH_COOLDOWN_MS = 90_000;
let refreshAttempts = 0;
let lastRefreshAttemptAt = 0;
const emitAuthFailure = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-refresh-failed'));
  }
};
const emitApiError = (detail: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-error', { detail }));
  }
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race<T>([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('refresh_timeout')), timeoutMs),
    ),
  ]);
};

const guardedRefresh = async () => {
  if (!refreshHandler) return null;
  const now = Date.now();
  if (now - lastRefreshAttemptAt > REFRESH_COOLDOWN_MS) {
    refreshAttempts = 0;
  }
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    emitAuthFailure();
    return null;
  }
  refreshAttempts += 1;
  lastRefreshAttemptAt = now;
  const refreshPromise = refreshHandler();
  const token = await withTimeout(refreshPromise, REFRESH_TIMEOUT_MS);
  refreshAttempts = 0;
  return token;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;
    if (error.response?.status === 401 && refreshHandler && original && !original._retry) {
      original._retry = true;
      try {
        refreshInFlight = refreshInFlight ?? guardedRefresh();
        const token = await refreshInFlight;
        refreshInFlight = null;
        if (token) {
          accessToken = token;
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch (e) {
        refreshInFlight = null;
        if ((e as Error)?.message === 'refresh_timeout') {
          emitApiError('Не удалось обновить сессию (таймаут)');
        }
        emitAuthFailure();
      }
    }
    if (error.response?.status === 401) {
      emitAuthFailure();
    }
    if (error.response?.status && error.response.status >= 400) {
      const message =
        (error.response.data?.message as string) ||
        (error.response.data?.error as string) ||
        'Ошибка сети';
      emitApiError(message);
    }
    return Promise.reject(error);
  },
);

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const registerUnauthorizedHandler = (handler: () => Promise<string | null | void>) => {
  refreshHandler = handler;
};

export default api;
