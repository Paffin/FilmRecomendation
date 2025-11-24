<template>
  <div class="surface-card rec-shell">
    <div class="top">
      <div>
        <p class="eyebrow">{{ t('recommendations.modeTitle') }}</p>
        <h2 class="section-title">{{ t('recommendations.todayWant') }}</h2>
        <div class="context-grid">
          <div>
            <label>{{ t('recommendations.mood') }}</label>
            <Slider v-model="mood" :min="0" :max="100" :step="1" />
            <small>{{ moodLabel }}</small>
          </div>
          <div>
            <label>{{ t('recommendations.mindset') }}</label>
            <Slider v-model="mindset" :min="0" :max="100" />
            <small>{{ mindsetLabel }}</small>
          </div>
          <div>
            <label>{{ t('recommendations.company') }}</label>
            <Dropdown v-model="company" :options="companies" option-label="label" option-value="value" />
          </div>
          <div>
            <label>{{ t('recommendations.time') }}</label>
            <Dropdown v-model="timeAvailable" :options="times" option-label="label" option-value="value" />
          </div>
          <div>
            <label>{{ t('recommendations.novelty') }}</label>
            <Dropdown v-model="noveltyBias" :options="noveltyOptions" option-label="label" option-value="value" />
          </div>
          <div>
            <label>{{ t('recommendations.pace') }}</label>
            <Dropdown v-model="pace" :options="paceOptions" option-label="label" option-value="value" />
          </div>
          <div>
            <label>{{ t('recommendations.freshness') }}</label>
            <Dropdown v-model="freshness" :options="freshnessOptions" option-label="label" option-value="value" />
          </div>
        </div>
      </div>
      <Button :label="t('common.refresh')" icon="pi pi-refresh" severity="secondary" :loading="loading" @click="load" />
    </div>

    <div v-if="loading" class="list">
      <Skeleton v-for="n in 5" :key="n" height="240px" border-radius="16px" />
    </div>
    <div v-else class="list">
      <div v-if="recommendations.length === 0" class="empty">{{ t('recommendations.empty') }}</div>
      <RecommendationCard
        v-for="item in recommendations"
        v-else
        :key="item.id"
        :title="item.displayTitle"
        :meta="item.meta"
        :secondary-meta="item.secondaryMeta"
        :tags="item.tags"
        :poster="item.poster"
        :explanation="item.explanation"
        :busy="actionLoading === item.id"
        @like="like(item)"
        @dislike="dislike(item)"
        @details="openDetails(item)"
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
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import RecommendationCard from '../../components/common/RecommendationCard.vue';
import { fetchRecommendations, sendRecommendationFeedback } from '../../api/recommendations';
import type { ApiTitle, MediaType } from '../../api/types';
import { useI18n } from 'vue-i18n';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface RecCard {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  displayTitle: string;
  meta: string;
   secondaryMeta: string;
  tags: string[];
  poster: string | null;
  explanation: string[];
}

const recommendations = ref<RecCard[]>([]);
const sessionId = ref<string | null>(null);
const loading = ref(false);
const actionLoading = ref<string | null>(null);
const toast = useToast();
const router = useRouter();
const { t } = useI18n();
const mood = ref(40);
const mindset = ref(50);
const company = ref('solo');
const timeAvailable = ref('90');
const noveltyBias = ref<'safe' | 'mix' | 'surprise'>('mix');
const pace = ref<'calm' | 'balanced' | 'dynamic'>('balanced');
const freshness = ref<'trending' | 'classic' | 'any'>('trending');

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
const noveltyOptions = [
  { label: 'Побольше знакомого', value: 'safe' },
  { label: 'Сбалансировано', value: 'mix' },
  { label: 'Сюрпризы', value: 'surprise' },
];
const paceOptions = [
  { label: 'Спокойно', value: 'calm' },
  { label: 'Сбалансировано', value: 'balanced' },
  { label: 'Динамично', value: 'dynamic' },
];
const freshnessOptions = [
  { label: 'Тренды', value: 'trending' },
  { label: 'Классика', value: 'classic' },
  { label: 'Любое', value: 'any' },
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
  const secondary = [item.title.countries?.slice(0, 2).join(', '), item.title.runtime ? `${item.title.runtime} мин` : null]
    .filter(Boolean)
    .join(' · ');

  return {
    id: item.title.id,
    tmdbId: item.title.tmdbId,
    mediaType: item.title.mediaType,
    displayTitle: item.title.russianTitle || item.title.originalTitle,
    meta: metaParts.join(' · '),
    secondaryMeta: secondary,
    tags: buildTags(item.title),
    poster: item.title.posterPath ? `${TMDB_IMAGE_BASE}${item.title.posterPath}` : null,
    explanation: item.explanation,
  };
};

const buildTags = (title: ApiTitle) => {
  const tags: string[] = [];
  if (title.genres?.length) tags.push(...title.genres.slice(0, 2));
  if (title.countries?.length) tags.push(title.countries[0]);
  return tags;
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
      noveltyBias: noveltyBias.value,
      pace: pace.value,
      freshness: freshness.value,
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
    recommendations.value = recommendations.value.filter((r) => r.id !== item.id);
    toast.add({ severity: 'success', summary: t('notifications.added'), detail: t('notifications.savedToWatchlist'), life: 2500 });
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

const openDetails = (item: RecCard) => {
  const why = encodeURIComponent(item.explanation?.join('||') ?? '');
  router.push({ path: `/title/${item.id}`, query: { why } });
};

onMounted(load);
</script>

<style scoped>
.rec-shell {
  background: linear-gradient(135deg, rgba(112, 68, 255, 0.06), rgba(34, 193, 195, 0.05));
  border: 1px solid var(--surface-border);
}

.top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
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

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 6px;
}
</style>
