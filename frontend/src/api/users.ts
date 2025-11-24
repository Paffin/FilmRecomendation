import api from './client';
import { useAuthStore } from '../store/auth';

export async function completeOnboarding() {
  const { data } = await api.post('/onboarding/complete');
  // обновим локальное состояние пользователя
  const auth = useAuthStore();
  if (auth.user) {
    auth.user = { ...auth.user, onboardingCompleted: true } as any;
    auth.persistUser();
  }
  return data;
}
