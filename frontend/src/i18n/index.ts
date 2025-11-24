import { createI18n } from 'vue-i18n';

const messages = {
  ru: {
    auth: {
      login: 'Войти',
      register: 'Зарегистрироваться',
    },
    recommendations: {
      title: 'Рекомендации',
      modeTitle: 'Режим вечера',
      todayWant: 'Сегодня хочу…',
      mood: 'Настроение',
      mindset: 'Хочу думать',
      company: 'Компания',
      time: 'Время есть',
      novelty: 'Новизна',
      pace: 'Темп',
      freshness: 'Свежесть',
      like: 'Нравится',
      toWatchlist: 'В список',
      dislike: 'Не подходит',
      watched: 'Смотрел',
      more: 'Подробнее',
      why: 'Почему в рекомендациях',
      empty: 'Пока нет рекомендаций. Попробуйте обновить настройки.',
      noPoster: 'Нет постера',
      cardBadge: 'Подборка AI',
    },
    watchlist: {
      title: 'Список к просмотру',
      empty: 'Нет тайтлов в списке. Лайкните рекомендации, чтобы добавить.',
      status: {
        planned: 'Запланировано',
        watching: 'Смотрю',
        watched: 'Просмотрено',
        dropped: 'Бросил',
      },
    },
    profile: {
      title: 'Профиль и прогресс',
      tasteMap: 'Карта вкуса',
      antiList: 'Антисписок',
      insights: 'Инсайты',
      stats: {
        watched: 'просмотрено',
        likes: 'лайков',
        planned: 'в списке',
        runtime: 'суммарно',
        favoriteGenre: 'любимый жанр',
        avgRating: 'средняя оценка',
      },
    },
    notifications: {
      added: 'Добавлено',
      savedToWatchlist: 'Тайтл в списке к просмотру',
      markedWatched: 'Тайтл отмечен как просмотренный',
    },
    common: {
      refresh: 'Обновить',
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
