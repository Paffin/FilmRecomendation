import { defineStore } from 'pinia';
import api, { setAccessToken } from '../api/client';

interface User {
  id: string;
  email: string;
  displayName: string;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  initialized: boolean;
}

const persistKey = 'kinovkus-auth';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: false,
    initialized: false,
  }),
  actions: {
    init() {
      if (this.initialized) return;
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          this.user = data.user;
          this.accessToken = data.accessToken;
          this.refreshToken = data.refreshToken;
          setAccessToken(this.accessToken);
        } catch {
          localStorage.removeItem(persistKey);
        }
      }
      this.initialized = true;
    },
    async register(payload: { email: string; password: string; displayName: string }) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/register', payload);
        this.setSession(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      } finally {
        this.loading = false;
      }
    },
    async login(payload: { email: string; password: string }) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/login', payload);
        this.setSession(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      if (!this.refreshToken) return;
      const { data } = await api.post('/auth/refresh', { refreshToken: this.refreshToken });
      this.setSession(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    },
    async fetchMe() {
      if (!this.accessToken) return;
      try {
        const { data } = await api.get('/me');
        this.user = data;
        this.persist();
      } catch (e) {
        this.logout();
        throw e;
      }
    },
    logout() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      localStorage.removeItem(persistKey);
      setAccessToken(null);
    },
    setSession(user: User, accessToken: string, refreshToken: string) {
      this.user = user;
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      setAccessToken(accessToken);
      this.persist();
    },
    persist() {
      localStorage.setItem(
        persistKey,
        JSON.stringify({ user: this.user, accessToken: this.accessToken, refreshToken: this.refreshToken }),
      );
    },
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken && state.user),
  },
});
