<template>
  <div class="surface-card rec-shell">
    <div class="top">
      <div>
        <p class="eyebrow">{{ t('recommendations.modeTitle') }}</p>
        <h2 class="section-title">{{ t('recommendations.todayWant') }}</h2>
        <p class="subtitle">
          Каждый лайк, дизлайк и «Смотрел» мгновенно переобучает подборку под ваш текущий настрой.
        </p>
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

    <div v-if="contextTags.length" class="context-tags surface-card">
      <Tag v-for="tag in contextTags" :key="tag" :value="tag" />
    </div>

    <div v-if="loading" class="list">
      <Skeleton v-for="n in 5" :key="n" height="240px" border-radius="16px" />
    </div>
    <TransitionGroup v-else name="rec-fade" tag="div" class="list">
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
        :status-label="item.statusLabel"
        :can-add-to-watchlist="item.canAddToWatchlist"
        :busy="actionLoading === item.id"
        @like="like(item)"
        @watched="watched(item)"
        @dislike="dislike(item)"
        @details="openDetails(item)"
        @add-to-watchlist="addToWatchlist(item)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Dropdown from 'primevue/dropdown';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import RecommendationCard from '../../components/common/RecommendationCard.vue';
import { fetchRecommendations, sendRecommendationFeedback } from '../../api/recommendations';
import type { ApiTitle, MediaType, RecommendationItemResponse, TitleStatus } from '../../api/types';
import { createUserTitle } from '../../api/userTitles';
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
  statusLabel?: string;
  canAddToWatchlist: boolean;
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
const contextTags = computed(() => [
  moodParam.value === 'light' ? 'Лёгкое' : moodParam.value === 'heavy' ? 'Тяжёлое' : 'Нейтральное',
  mindsetParam.value === 'relax' ? 'Расслабиться' : mindsetParam.value === 'focus' ? 'Подумать' : 'Баланс',
  companies.find((c) => c.value === company.value)?.label ?? '',
  times.find((t) => t.value === timeAvailable.value)?.label ?? '',
  noveltyOptions.find((n) => n.value === noveltyBias.value)?.label ?? '',
  paceOptions.find((p) => p.value === pace.value)?.label ?? '',
  freshnessOptions.find((f) => f.value === freshness.value)?.label ?? '',
].filter(Boolean));

const mapToCard = (item: RecommendationItemResponse): RecCard => {
  const year = item.title.releaseDate ? new Date(item.title.releaseDate).getFullYear() : null;
  const metaParts: string[] = [];
  if (year) metaParts.push(String(year));
  if (item.title.tmdbRating) metaParts.push(`TMDB ${item.title.tmdbRating.toFixed(1)}`);
  metaParts.push(item.title.mediaType === 'movie' ? 'Фильм' : item.title.mediaType === 'tv' ? 'Сериал' : 'Тайтл');
  const secondary = [item.title.countries?.slice(0, 2).join(', '), item.title.runtime ? `${item.title.runtime} мин` : null]
    .filter(Boolean)
    .join(' · ');

  const status = item.userState?.status ?? null;
  const liked = item.userState?.liked ?? false;
  const disliked = item.userState?.disliked ?? false;

  const statusLabel = buildStatusLabel(status, liked, disliked);
  const canAddToWatchlist =
    !item.userState ||
    (!liked &&
      !disliked &&
      status !== ('planned' as TitleStatus) &&
      status !== ('watching' as TitleStatus) &&
      status !== ('watched' as TitleStatus));

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
    statusLabel,
    canAddToWatchlist,
  };
};

const buildTags = (title: ApiTitle) => {
  const tags: string[] = [];
  if (title.genres?.length) tags.push(...title.genres.slice(0, 2));
  const country = title.countries?.[0];
  if (country) tags.push(country);
  return tags;
};

const buildStatusLabel = (status: TitleStatus | null, liked: boolean, disliked: boolean): string | undefined => {
  if (disliked || status === 'dropped') return 'В антисписке';
  if (status === 'watched') return 'Смотрел';
  if (status === 'watching') return 'Смотрю';
  if (status === 'planned' || liked) return 'В списке';
  return undefined;
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
    const res = await sendRecommendationFeedback({
      sessionId: sessionId.value,
      titleId: item.id,
      feedback: 'like',
    });
    const index = recommendations.value.findIndex((r) => r.id === item.id);
    const replacement = res?.replacement ? mapToCard(res.replacement) : null;
    if (index >= 0) {
      if (replacement) {
        recommendations.value.splice(index, 1, replacement);
      } else {
        // если движок не смог найти замену, обновляем всю подборку
        recommendations.value.splice(index, 1);
        await load();
      }
    }
    toast.add({
      severity: 'success',
      summary: t('notifications.added'),
      detail: t('notifications.savedToWatchlist'),
      life: 2500,
    });
    if (recommendations.value.length === 0) await load();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Не удалось сохранить', detail: 'Попробуйте ещё раз', life: 4000 });
  } finally {
    actionLoading.value = null;
  }
};

const watched = async (item: RecCard) => {
  if (!sessionId.value) return;
  actionLoading.value = item.id;
  try {
    const res = await sendRecommendationFeedback({
      sessionId: sessionId.value,
      titleId: item.id,
      feedback: 'watched',
    });
    const index = recommendations.value.findIndex((r) => r.id === item.id);
    const replacement = res?.replacement ? mapToCard(res.replacement) : null;
    if (index >= 0) {
      if (replacement) {
        recommendations.value.splice(index, 1, replacement);
      } else {
        recommendations.value.splice(index, 1);
        await load();
      }
    }
    toast.add({
      severity: 'success',
      summary: t('notifications.added'),
      detail: t('notifications.markedWatched'),
      life: 2500,
    });
    if (recommendations.value.length === 0) await load();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось сохранить',
      detail: 'Попробуйте ещё раз',
      life: 4000,
    });
  } finally {
    actionLoading.value = null;
  }
};

const dislike = async (item: RecCard) => {
  if (!sessionId.value) return;
  actionLoading.value = item.id;
  try {
    const res = await sendRecommendationFeedback({
      sessionId: sessionId.value,
      titleId: item.id,
      feedback: 'dislike',
    });
    const index = recommendations.value.findIndex((r) => r.id === item.id);
    const replacement = res?.replacement ? mapToCard(res.replacement) : null;
    if (index >= 0) {
      if (replacement) {
        recommendations.value.splice(index, 1, replacement);
      } else {
        recommendations.value.splice(index, 1);
        await load();
      }
    }
    toast.add({ severity: 'info', summary: 'Обновлено', detail: 'Мы учли ваш дизлайк', life: 2500 });
    if (recommendations.value.length === 0) await load();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Не удалось обновить', detail: 'Попробуйте ещё раз', life: 4000 });
  } finally {
    actionLoading.value = null;
  }
};

const addToWatchlist = async (item: RecCard) => {
  actionLoading.value = item.id;
  try {
    await createUserTitle({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      status: 'planned',
      source: 'recommendation',
    });
    recommendations.value = recommendations.value.map((rec) =>
      rec.id === item.id
        ? {
            ...rec,
            statusLabel: 'В списке',
            canAddToWatchlist: false,
          }
        : rec,
    );
    toast.add({
      severity: 'success',
      summary: t('notifications.added'),
      detail: t('notifications.savedToWatchlist'),
      life: 2500,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось сохранить',
      detail: 'Попробуйте ещё раз',
      life: 4000,
    });
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

.context-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
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

.subtitle {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.rec-fade-enter-active,
.rec-fade-leave-active {
  transition: all 0.25s ease-out;
}

.rec-fade-enter-from,
.rec-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
