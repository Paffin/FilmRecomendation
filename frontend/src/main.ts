import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import i18n from './i18n';

import 'primeicons/primeicons.css';
import './styles/theme.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(PrimeVue, {
  ripple: true,
  inputStyle: 'filled',
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: 'body',
      cssLayer: { name: 'primevue' },
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');
