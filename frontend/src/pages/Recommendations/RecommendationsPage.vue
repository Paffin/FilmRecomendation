<template>
  <div class="surface-card">
    <div class="top">
      <div>
        <h2 class="section-title">Сегодня хочу…</h2>
        <div class="context-grid">
          <div>
            <label>Настроение</label>
            <Slider v-model="mood" :min="0" :max="100" :step="1" />
            <small>{{ moodLabel }}</small>
          </div>
          <div>
            <label>Хочу думать</label>
            <Slider v-model="mindset" :min="0" :max="100" />
            <small>{{ mindsetLabel }}</small>
          </div>
          <div>
            <label>Компания</label>
            <Dropdown v-model="company" :options="companies" optionLabel="label" optionValue="value" />
          </div>
          <div>
            <label>Время есть</label>
            <Dropdown v-model="timeAvailable" :options="times" optionLabel="label" optionValue="value" />
          </div>
        </div>
      </div>
      <Button label="Обновить" icon="pi pi-refresh" @click="load" :loading="loading" />
    </div>

    <div class="list" v-if="loading">
      <Skeleton v-for="n in 5" :key="n" height="220px" borderRadius="16px" />
    </div>
    <div class="list" v-else>
      <div v-if="recommendations.length === 0" class="empty">Пока нет рекомендаций. Попробуйте обновить.</div>
      <RecommendationCard
        v-else
        v-for="item in recommendations"
        :key="item.id"
        :title="item.displayTitle"
        :meta="item.meta"
        :tags="item.tags"
        :poster="item.poster"
        :explanation="item.explanation"
        :busy="actionLoading === item.id"
        @like="like(item)"
        @dislike="dislike(item)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Dropdown from 'primevue/dropdown';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import RecommendationCard from '../../components/common/RecommendationCard.vue';
import { fetchRecommendations, sendRecommendationFeedback } from '../../api/recommendations';
import { createUserTitle } from '../../api/userTitles';
import { ApiTitle, MediaType } from '../../api/types';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface RecCard {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  displayTitle: string;
  meta: string;
  tags: string[];
  poster: string | null;
  explanation: string[];
}

const recommendations = ref<RecCard[]>([]);
const sessionId = ref<string | null>(null);
const loading = ref(false);
const actionLoading = ref<string | null>(null);
const toast = useToast();
const mood = ref(40);
const mindset = ref(50);
const company = ref('solo');
const timeAvailable = ref('90');

const companies = [
  { label: 'Один', value: 'solo' },
  { label: 'Вдвоём', value: 'duo' },
  { label: 'Друзья', value: 'friends' },
  { label: 'Семья', value: 'family' },
];
const times = [
  { label: '30–60 мин', value: '60' },
  { label: '1–2 часа', value: '90' },
  { label: '2+ часа', value: '120' },
];

const moodLabel = computed(() => (mood.value < 40 ? 'Лёгкое' : mood.value > 70 ? 'Тяжёлое' : 'Нейтральное'));
const mindsetLabel = computed(() =>
  mindset.value < 40 ? 'Расслабиться' : mindset.value > 70 ? 'Подумать' : 'Можно и так, и так',
);
const moodParam = computed(() => (mood.value < 40 ? 'light' : mood.value > 70 ? 'heavy' : 'neutral'));
const mindsetParam = computed(() => (mindset.value < 40 ? 'relax' : mindset.value > 70 ? 'focus' : 'balanced'));

const mapToCard = (item: { title: ApiTitle; explanation: string[] }): RecCard => {
  const year = item.title.releaseDate ? new Date(item.title.releaseDate).getFullYear() : null;
  const metaParts: string[] = [];
  if (year) metaParts.push(String(year));
  if (item.title.tmdbRating) metaParts.push(`TMDB ${item.title.tmdbRating.toFixed(1)}`);
  metaParts.push(item.title.mediaType === 'movie' ? 'Фильм' : item.title.mediaType === 'tv' ? 'Сериал' : 'Тайтл');

  return {
    id: item.title.id,
    tmdbId: item.title.tmdbId,
    mediaType: item.title.mediaType,
    displayTitle: item.title.russianTitle || item.title.originalTitle,
    meta: metaParts.join(' · '),
    tags: item.title.genres?.slice(0, 3) ?? [],
    poster: item.title.posterPath ? `${TMDB_IMAGE_BASE}${item.title.posterPath}` : null,
    explanation: item.explanation,
  };
};

const load = async () => {
  loading.value = true;
  try {
    const data = await fetchRecommendations({
      limit: 5,
      mood: moodParam.value,
      mindset: mindsetParam.value,
      company: company.value,
      timeAvailable: timeAvailable.value,
    });
    sessionId.value = data.sessionId;
    recommendations.value = data.items.map(mapToCard);
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось загрузить рекомендации', life: 4000 });
  } finally {
    loading.value = false;
  }
};

const like = async (item: RecCard) => {
  if (!sessionId.value) return;
  actionLoading.value = item.id;
  try {
    await sendRecommendationFeedback({ sessionId: sessionId.value, titleId: item.id, feedback: 'like' });
    await createUserTitle({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      status: 'planned',
      source: 'recommendation',
      liked: true,
    });
    recommendations.value = recommendations.value.filter((r) => r.id !== item.id);
    toast.add({ severity: 'success', summary: 'Добавлено', detail: 'Тайтл в списке к просмотру', life: 2500 });
    if (recommendations.value.length === 0) await load();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Не удалось сохранить', detail: 'Попробуйте ещё раз', life: 4000 });
  } finally {
    actionLoading.value = null;
  }
};

const dislike = async (item: RecCard) => {
  if (!sessionId.value) return;
  actionLoading.value = item.id;
  try {
    const res = await sendRecommendationFeedback({ sessionId: sessionId.value, titleId: item.id, feedback: 'dislike' });
    const index = recommendations.value.findIndex((r) => r.id === item.id);
    if (res?.replacement?.title && index >= 0) {
      recommendations.value.splice(index, 1, mapToCard(res.replacement));
    } else {
      recommendations.value = recommendations.value.filter((r) => r.id !== item.id);
    }
    toast.add({ severity: 'info', summary: 'Обновлено', detail: 'Мы учли ваш дизлайк', life: 2500 });
    if (recommendations.value.length === 0) await load();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Не удалось обновить', detail: 'Попробуйте ещё раз', life: 4000 });
  } finally {
    actionLoading.value = null;
  }
};

onMounted(load);
</script>

<style scoped>
.top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.list {
  margin-top: 16px;
  display: grid;
  gap: 14px;
}

.empty {
  color: var(--text-secondary);
  padding: 12px 0;
}

label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
}

small {
  color: var(--text-secondary);
}
</style>
