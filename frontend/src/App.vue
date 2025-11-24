<template>
  <div class="app-shell">
    <Toast position="top-right" />
    <header class="app-header">
      <div class="brand">КиноВкус</div>
      <nav class="nav">
        <RouterLink to="/recommendations">Рекомендации</RouterLink>
        <RouterLink to="/watchlist">Список</RouterLink>
        <RouterLink to="/history">История</RouterLink>
        <RouterLink to="/profile">Профиль</RouterLink>
      </nav>
      <div class="auth-slot">
        <template v-if="auth.isAuthenticated">
          <span class="user-name">Привет, {{ auth.user?.displayName }}</span>
          <button class="logout" @click="logout">Выйти</button>
        </template>
        <RouterLink v-else class="auth-link" to="/auth">Войти</RouterLink>
      </div>
    </header>
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useRouter } from 'vue-router';
import Toast from 'primevue/toast';
import { useAuthStore } from './store/auth';

const auth = useAuthStore();
const router = useRouter();

auth.init();
if (auth.accessToken && !auth.user) {
  auth.fetchMe().catch(() => auth.logout());
}

const logout = () => {
  auth.logout();
  router.push('/auth');
};
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, rgba(87, 99, 255, 0.1), transparent 35%),
    radial-gradient(circle at 80% 0%, rgba(255, 73, 167, 0.12), transparent 35%),
    #0c0d11;
  color: var(--text-color);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(16, 17, 23, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--surface-border);
}

.brand {
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #8ab4ff;
}

.nav {
  display: flex;
  gap: 18px;
  align-items: center;
}

.nav a {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav a.router-link-active {
  color: #ffffff;
}

.nav a:hover {
  color: #d3d9ff;
}

.auth-slot {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-link,
.logout {
  color: #ffffff;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid var(--surface-border);
  padding: 6px 12px;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-link:hover,
.logout:hover {
  border-color: #8ab4ff;
}

.user-name {
  color: #d3d9ff;
  font-weight: 600;
}

.app-content {
  padding: 24px 32px 48px;
}

@media (max-width: 768px) {
  .app-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  .nav {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }
  .auth-link {
    width: 100%;
    text-align: center;
  }
}
</style>
