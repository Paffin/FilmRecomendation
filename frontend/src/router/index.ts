import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/recommendations' },
    { path: '/auth', component: () => import('../pages/Auth/AuthPage.vue') },
    { path: '/onboarding', component: () => import('../pages/Onboarding/OnboardingPage.vue'), meta: { requiresAuth: true } },
    { path: '/recommendations', component: () => import('../pages/Recommendations/RecommendationsPage.vue'), meta: { requiresAuth: true } },
    { path: '/watchlist', component: () => import('../pages/Watchlist/WatchlistPage.vue'), meta: { requiresAuth: true } },
    { path: '/history', component: () => import('../pages/History/HistoryPage.vue'), meta: { requiresAuth: true } },
    { path: '/profile', component: () => import('../pages/Profile/ProfilePage.vue'), meta: { requiresAuth: true } },
    { path: '/title/:id', component: () => import('../pages/TitleDetails/TitleDetailsPage.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', component: () => import('../pages/NotFound.vue') },
  ],
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  auth.init();

  // lazy fetch user once we have token
  if (auth.accessToken && !auth.user && !auth.loading) {
    try {
      await auth.fetchMe();
    } catch {
      // failed to refresh session, fallback to logout
    }
  }

  if (to.path === '/auth' && auth.isAuthenticated) {
    return next('/recommendations');
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ path: '/auth', query: { redirect: to.fullPath } });
  }

  return next();
});

export default router;
