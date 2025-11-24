<template>
  <div class="auth-wrapper">
    <div class="surface-card auth-card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">Войти</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">Регистрация</button>
      </div>
      <form class="form" @submit.prevent="submit">
        <div class="form-field">
          <label for="email" class="field-label">Email</label>
          <InputText id="email" v-model="email" autocomplete="email" class="w-full" />
        </div>
        <div class="form-field">
          <label for="password" class="field-label">Пароль</label>
          <Password id="password" v-model="password" toggle-mask :feedback="false" class="w-full" />
        </div>
        <div v-if="mode === 'register'" class="form-field">
          <label for="displayName" class="field-label">Имя</label>
          <InputText id="displayName" v-model="displayName" class="w-full" />
        </div>
        <Button
          :label="mode === 'login' ? 'Войти' : 'Создать аккаунт'"
          type="submit"
          :loading="auth.loading"
          class="w-full"
        />
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../store/auth';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';

const auth = useAuthStore();
const router = useRouter();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const displayName = ref('');

const submit = async () => {
  if (mode.value === 'login') {
    await auth.login({ email: email.value, password: password.value });
  } else {
    await auth.register({ email: email.value, password: password.value, displayName: displayName.value || 'Киноман' });
  }
  if (auth.user) router.push('/recommendations');
};
</script>

<style scoped>
.auth-wrapper {
  display: grid;
  place-items: center;
  min-height: 70vh;
}

.auth-card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  background: var(--surface-2);
  border-radius: 12px;
  padding: 6px;
  gap: 6px;
}

.tabs button {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tabs button.active {
  background: linear-gradient(135deg, #3953ff, #8ab4ff);
  color: #fff;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.field-label {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
