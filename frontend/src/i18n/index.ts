import { createI18n } from 'vue-i18n';

const messages = {
  ru: {
    auth: {
      login: 'Войти',
      register: 'Зарегистрироваться',
    },
    recommendations: {
      title: 'Рекомендации',
      like: 'Нравится',
      dislike: 'Не подходит',
      why: 'Почему в рекомендациях',
    },
  },
};

const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  messages,
});

export default i18n;
