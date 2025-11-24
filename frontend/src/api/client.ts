import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null | void>) | null = null;
let refreshInFlight: Promise<string | null | void> | null = null;
const emitAuthFailure = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-refresh-failed'));
  }
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;
    if (error.response?.status === 401 && refreshHandler && original && !original._retry) {
      original._retry = true;
      try {
        refreshInFlight = refreshInFlight ?? refreshHandler();
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
        emitAuthFailure();
      }
    }
    if (error.response?.status === 401) {
      emitAuthFailure();
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
