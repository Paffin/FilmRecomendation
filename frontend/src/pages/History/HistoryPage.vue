<template>
  <div class="surface-card">
    <div class="header">
      <h2 class="section-title">История просмотра</h2>
      <div class="filters">
        <Dropdown v-model="period" :options="periods" option-label="label" option-value="value" />
        <Dropdown v-model="mediaType" :options="mediaTypes" option-label="label" option-value="value" show-clear placeholder="Тип" />
        <MultiSelect
          v-model="genres"
          :options="genreOptions"
          option-label="label"
          option-value="value"
          display="chip"
          placeholder="Жанры"
        />
      </div>
    </div>
    <div v-if="loading" class="list">
      <Skeleton v-for="i in 4" :key="i" height="90px" border-radius="14px" />
    </div>
    <div v-else class="list">
      <div v-if="filteredHistory.length === 0" class="empty">Пока нет просмотренных тайтлов за выбранный период.</div>
      <div v-for="item in filteredHistory" v-else :key="item.id" class="surface-card row">
        <div>
          <div class="title">{{ item.title.russianTitle || item.title.originalTitle }}</div>
          <div class="meta">{{ formatDate(item.lastInteractionAt) }} · {{ meta(item) }}</div>
        </div>
        <div class="actions">
          <Rating :model-value="item.rating ?? 0" :cancel="false" @update:model-value="(v) => changeRating(item, v)" />
          <div class="buttons">
            <Button icon="pi pi-thumbs-up" text severity="success" :outlined="!item.liked" @click="() => like(item)" />
            <Button icon="pi pi-thumbs-down" text severity="danger" :outlined="!item.disliked" @click="() => dislike(item)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Rating from 'primevue/rating';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import { getHistory } from '../../api/analytics';
import { updateUserTitle } from '../../api/userTitles';
import type { UserTitleStateResponse } from '../../api/types';

const periods = [
  { label: '30 дней', value: 30 },
  { label: '90 дней', value: 90 },
  { label: 'Год', value: 365 },
];
const mediaTypes = [
  { label: 'Все типы', value: null },
  { label: 'Фильмы', value: 'movie' },
  { label: 'Сериалы', value: 'tv' },
  { label: 'Аниме', value: 'anime' },
  { label: 'Мультфильмы', value: 'cartoon' },
];

const period = ref(90);
const mediaType = ref<string | null>(null);
const genres = ref<string[]>([]);
const history = ref<UserTitleStateResponse[]>([]);
const loading = ref(true);
const toast = useToast();

onMounted(async () => {
  try {
    history.value = await getHistory();
  } finally {
    loading.value = false;
  }
});

const filteredHistory = computed(() => {
  const days = period.value;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.value.filter((h) => {
    if (new Date(h.lastInteractionAt).getTime() < cutoff) return false;
    if (mediaType.value && h.title.mediaType !== mediaType.value) return false;
    if (genres.value.length && !h.title.genres?.some((g) => genres.value.includes(g))) return false;
    return true;
  });
});

const genreOptions = computed(() => {
  const counter: Record<string, number> = {};
  history.value.forEach((h) => h.title.genres?.forEach((g) => (counter[g] = (counter[g] ?? 0) + 1)));
  return Object.keys(counter)
    .sort()
    .map((g) => ({ label: `${g} (${counter[g]})`, value: g }));
});

const meta = (item: UserTitleStateResponse) => {
  const year = item.title.releaseDate ? new Date(item.title.releaseDate).getFullYear() : null;
  const genres = item.title.genres?.slice(0, 2).join(', ');
  return [year, genres].filter(Boolean).join(' · ');
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');

const changeRating = async (item: UserTitleStateResponse, rating: number) => {
  try {
    const updated = await updateUserTitle(item.id, { rating: rating ?? null });
    replaceItem(updated);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось сохранить', life: 2500 });
  }
};

const like = async (item: UserTitleStateResponse) => {
  try {
    const updated = await updateUserTitle(item.id, { liked: !item.liked, disliked: false });
    replaceItem(updated);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось обновить лайк', life: 2500 });
  }
};

const dislike = async (item: UserTitleStateResponse) => {
  try {
    const updated = await updateUserTitle(item.id, { disliked: !item.disliked, liked: false, status: 'dropped' });
    replaceItem(updated);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось обновить дизлайк', life: 2500 });
  }
};

const replaceItem = (updated: UserTitleStateResponse) => {
  const idx = history.value.findIndex((h) => h.id === updated.id);
  if (idx >= 0) history.value[idx] = updated;
};
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title { font-weight: 700; }
.meta { color: var(--text-secondary); }
.actions { display: flex; align-items: center; gap: 12px; }
.buttons { display: flex; gap: 6px; }
.empty { color: var(--text-secondary); }
@media (max-width: 720px) { .row { flex-direction: column; align-items: flex-start; gap: 10px; } }
</style>
