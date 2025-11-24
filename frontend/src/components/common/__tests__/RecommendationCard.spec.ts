import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RecommendationCard from '../RecommendationCard.vue';
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  messages: { ru: { recommendations: { why: 'Почему в рекомендациях', like: 'Нравится', dislike: 'Не подходит', more: 'Подробнее', cardBadge: 'AI', noPoster: 'Нет постера' } } },
});

const mountWithPlugins = (props: any) =>
  mount(RecommendationCard, {
    props,
    global: {
      plugins: [PrimeVue, i18n],
      components: { Button, Tag },
    },
  });

describe('RecommendationCard', () => {
  it('renders title and meta', () => {
    const wrapper = mountWithPlugins({ title: 'Фильм', meta: '2024 · TMDB 8.1', tags: ['драма'] });
    expect(wrapper.text()).toContain('Фильм');
    expect(wrapper.text()).toContain('TMDB 8.1');
  });

  it('emits like/dislike/details', async () => {
    const wrapper = mountWithPlugins({ title: 'Фильм', explanation: ['Тест'] });
    const buttons = wrapper.findAllComponents(Button);
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    await buttons[0]?.trigger('click'); // details
    await buttons[1]?.trigger('click'); // like
    await buttons[2]?.trigger('click'); // dislike
    expect(wrapper.emitted('details')).toBeTruthy();
    expect(wrapper.emitted('like')).toBeTruthy();
    expect(wrapper.emitted('dislike')).toBeTruthy();
  });
});
