import { defineStore } from 'pinia';
import api, { registerUnauthorizedHandler, setAccessToken } from '../api/client';

interface User {
  id: string;
  email: string;
  displayName: string;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  initialized: boolean;
}

const persistKey = 'kinovkus-user';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    loading: false,
    initialized: false,
  }),
  actions: {
    hydrateUser() {
      const raw = sessionStorage.getItem(persistKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        this.user = parsed.user;
      } catch {
        sessionStorage.removeItem(persistKey);
      }
    },
    persistUser() {
      if (this.user) {
        sessionStorage.setItem(persistKey, JSON.stringify({ user: this.user }));
      } else {
        sessionStorage.removeItem(persistKey);
      }
    },
    async bootstrap() {
      if (this.initialized) return;
      this.hydrateUser();
      registerUnauthorizedHandler(async () => (this.user ? this.refreshWithCookie(true) : null));

      // Avoid hitting /auth/refresh when we clearly have no session
      if (this.user) {
        try {
          await this.refreshWithCookie(true);
        } catch {
          // silent fail — user is not logged in
        }
      }
      this.initialized = true;
    },
    async register(payload: { email: string; password: string; displayName: string }) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/register', payload);
        this.setSession(data.user, data.tokens.accessToken);
      } finally {
        this.loading = false;
      }
    },
    async login(payload: { email: string; password: string }) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/login', payload);
        this.setSession(data.user, data.tokens.accessToken);
      } finally {
        this.loading = false;
      }
    },
    async refreshWithCookie(silent = false): Promise<string | null> {
      try {
        const { data } = await api.post('/auth/refresh');
        this.setSession(data.user, data.tokens.accessToken);
        return data.tokens.accessToken ?? null;
      } catch (e) {
        if (!silent) throw e;
        this.logout(false);
        return null;
      }
    },
    async fetchMe() {
      if (!this.accessToken) return;
      try {
        const { data } = await api.get('/me');
        this.user = data;
        this.persistUser();
      } catch (e) {
        this.logout();
        throw e;
      }
    },
    async logout(callApi = true) {
      if (callApi) {
        try {
          await api.post('/auth/logout');
        } catch {
          // ignore
        }
      }
      this.user = null;
      this.accessToken = null;
      sessionStorage.removeItem(persistKey);
      setAccessToken(null);
    },
    setSession(user: User, accessToken: string) {
      this.user = user;
      this.accessToken = accessToken;
      setAccessToken(accessToken);
      this.persistUser();
    },
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken && state.user),
    isOnboarded: (state) => Boolean(state.user?.onboardingCompleted),
  },
});
