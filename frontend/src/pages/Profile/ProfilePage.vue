<template>
  <div class="grid">
    <div class="surface-card kpi">
      <h2 class="section-title">{{ t('profile.title') }}</h2>
      <div v-if="!loading && overview" class="stats">
        <div class="stat">
          <div class="value">{{ overview.watchedCount }}</div>
          <div class="label">{{ t('profile.stats.watched') }}</div>
        </div>
        <div class="stat">
          <div class="value">{{ overview.likedCount }}</div>
          <div class="label">{{ t('profile.stats.likes') }}</div>
        </div>
        <div class="stat">
          <div class="value">{{ overview.plannedCount }}</div>
          <div class="label">{{ t('profile.stats.planned') }}</div>
        </div>
        <div class="stat">
          <div class="value">{{ overview.totalRuntimeHours }} ч</div>
          <div class="label">{{ t('profile.stats.runtime') }}</div>
        </div>
        <div class="stat">
          <div class="value">{{ overview.topGenre || '—' }}</div>
          <div class="label">{{ t('profile.stats.favoriteGenre') }}</div>
        </div>
        <div class="stat">
          <div class="value">{{ overview.averageRating ? overview.averageRating : '—' }}</div>
          <div class="label">{{ t('profile.stats.avgRating') }}</div>
        </div>
      </div>
      <div v-else class="stats">
        <Skeleton v-for="i in 6" :key="i" height="48px" border-radius="14px" />
      </div>
      <div v-if="!loading && overview && insights.length" class="insights">
        <h3 class="insights-title">{{ t('profile.insights') }}</h3>
        <ul>
          <li v-for="line in insights" :key="line">{{ line }}</li>
        </ul>
      </div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">{{ t('profile.tasteMap') }}</h3>
      <div v-if="loading" class="chart-skeleton">
        <Skeleton height="280px" border-radius="14px" />
      </div>
      <div v-else>
        <Radar
          v-if="taste"
          :data="tasteRadarData"
          :options="{ scales: { r: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { display: false } } } }"
        />
        <div v-else class="empty">Нет данных — отметьте просмотренные тайтлы</div>
        <p v-if="taste" class="taste-caption">
          Чем выше значение по лучу, тем сильнее выражен ваш интерес к жанру. Карта строится по вашим лайкам и
          отметкам «Смотрел».
        </p>
      </div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Жанры</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="220px" border-radius="14px" /></div>
      <Bar v-else-if="taste && genreChartData.labels.length" :data="genreChartData" :options="barOptions" />
      <div v-else class="empty">Пока нет статистики</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Страны</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="220px" border-radius="14px" /></div>
      <Doughnut v-else-if="taste && countryChartData.labels.length" :data="countryChartData" :options="doughnutOptions" />
      <div v-else class="empty">Недостаточно данных</div>
    </div>

    <TasteGalaxy :data="galaxy" :loading="loadingGalaxy" @open-title="openGalaxyTitle" />

    <div class="surface-card">
      <h3 class="section-title">{{ t('profile.antiList') }}</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="120px" border-radius="12px" /></div>
      <div v-else-if="taste && taste.antiList.length" class="anti">
        <div v-for="item in taste.antiList" :key="item.id" class="anti-row">
          <RouterLink class="anti-title" :to="`/title/${item.id}`">{{ item.title }}</RouterLink>
          <Button label="Вернуть" size="small" text icon="pi pi-undo" @click="() => restoreFromAnti(item.id)" />
        </div>
      </div>
      <div v-else class="empty">Вы ещё не добавляли тайтлы в антисписок</div>
    </div>

    <div class="surface-card editor">
      <h3 class="section-title">Эксперимент: ручка сигналов</h3>
      <p class="editor-caption">
        Поиграйте ползунками ниже — мы временно усилим или ослабим влияние групп сигналов и соберём подборку под ваши
        настройки в реальном времени.
      </p>
      <div class="editor-grid">
        <div class="editor-field">
          <label>Жанры</label>
          <Slider v-model="genreOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(genreOverride) }}</small>
        </div>
        <div class="editor-field">
          <label>Настроение</label>
          <Slider v-model="moodOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(moodOverride) }}</small>
        </div>
        <div class="editor-field">
          <label>Новизна</label>
          <Slider v-model="noveltyOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(noveltyOverride) }}</small>
        </div>
        <div class="editor-field">
          <label>Десятилетия</label>
          <Slider v-model="decadeOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(decadeOverride) }}</small>
        </div>
        <div class="editor-field">
          <label>Страны</label>
          <Slider v-model="countryOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(countryOverride) }}</small>
        </div>
        <div class="editor-field">
          <label>Авторы и актёры</label>
          <Slider v-model="peopleOverride" :min="0" :max="100" />
          <small>{{ overrideLabel(peopleOverride) }}</small>
        </div>
      </div>
      <div class="editor-actions">
        <Button label="Обновить подборку" icon="pi pi-refresh" :loading="editorLoading" @click="loadEditorRecs" />
      </div>
      <div class="editor-list">
        <Skeleton v-if="editorLoading && editorRecs.length === 0" height="200px" border-radius="14px" />
        <div v-else-if="!editorLoading && editorRecs.length === 0" class="empty">
          Нажмите «Обновить подборку», чтобы увидеть рекомендации под ручные настройки.
        </div>
        <RecommendationCard
          v-for="item in editorRecs"
          :key="item.id"
          :title="item.displayTitle"
          :meta="item.meta"
          :secondary-meta="item.secondaryMeta"
          :tags="item.tags"
          :poster="item.poster"
          :explanation="item.explanation"
          :status-label="item.statusLabel"
          :can-add-to-watchlist="item.canAddToWatchlist"
          :busy="false"
          @like="() => handleEditorLike(item)"
          @watched="() => handleEditorWatched(item)"
          @dislike="() => handleEditorDislike(item)"
          @details="() => openEditorDetails(item)"
          @add-to-watchlist="() => handleEditorAddToWatchlist(item)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Skeleton from 'primevue/skeleton';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import { Bar, Radar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { getOverview, getTasteMap, getTasteGalaxy } from '../../api/analytics';
import type { OverviewResponse, TasteMapResponse, TasteGalaxyResponse } from '../../api/analytics';
import { useI18n } from 'vue-i18n';
import { updateUserTitle, getUserTitleByTitleId, createUserTitle } from '../../api/userTitles';
import { useToast } from 'primevue/usetoast';
import RecommendationCard from '../../components/common/RecommendationCard.vue';
import { fetchRecommendations } from '../../api/recommendations';
import type { MediaType, RecommendationItemResponse, TitleStatus } from '../../api/types';
import TasteGalaxy from '../../components/profile/TasteGalaxy.vue';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
);

const overview = ref<OverviewResponse | null>(null);
const taste = ref<TasteMapResponse | null>(null);
const loading = ref(true);
const loadingGalaxy = ref(true);
const galaxy = ref<TasteGalaxyResponse | null>(null);
const { t } = useI18n();
const toast = useToast();
const router = useRouter();

const genreOverride = ref(50);
const moodOverride = ref(50);
const noveltyOverride = ref(50);
const decadeOverride = ref(50);
const countryOverride = ref(50);
const peopleOverride = ref(50);
const editorLoading = ref(false);

interface EditorRecCard {
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

const editorRecs = ref<EditorRecCard[]>([]);

onMounted(async () => {
  try {
    const [o, t, g] = await Promise.all([getOverview(), getTasteMap(), getTasteGalaxy()]);
    overview.value = o;
    taste.value = t;
    galaxy.value = g;
  } finally {
    loading.value = false;
    loadingGalaxy.value = false;
  }
});

const restoreFromAnti = async (titleId: string) => {
  try {
    const state = await getUserTitleByTitleId(titleId);
    if (!state) throw new Error('not found');
    await updateUserTitle(state.id, { disliked: false, status: 'planned' });
    if (taste.value) {
      taste.value.antiList = taste.value.antiList.filter((i) => i.id !== titleId);
    }
    toast.add({ severity: 'success', summary: 'Вернули в рекомендации', life: 2000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось вернуть', life: 2500 });
  }
};

const topEntries = (record: Record<string, number>, limit = 6) =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

const tasteRadarData = computed(() => {
  if (!taste.value) return { labels: [], datasets: [] };
  const genres = topEntries(taste.value.genres, 6);
  return {
    labels: genres.map(([k]) => k),
    datasets: [
      {
        label: 'Интенсивность вкуса',
        data: genres.map(([, v]) => v),
        backgroundColor: 'rgba(138,180,255,0.2)',
        borderColor: '#8ab4ff',
      },
    ],
  };
});

const genreChartData = computed(() => {
  if (!taste.value) return { labels: [], datasets: [] };
  const genres = topEntries(taste.value.genres, 8);
  return {
    labels: genres.map(([k]) => k),
    datasets: [
      {
        label: 'Жанры',
        data: genres.map(([, v]) => v),
        backgroundColor: 'rgba(255,73,167,0.4)',
        borderRadius: 8,
      },
    ],
  };
});

const countryChartData = computed(() => {
  if (!taste.value) return { labels: [], datasets: [] };
  const countries = topEntries(taste.value.countries, 6);
  return {
    labels: countries.map(([k]) => k),
    datasets: [
      {
        data: countries.map(([, v]) => v),
        backgroundColor: ['#8ab4ff', '#ff49a7', '#8b5cf6', '#34d399', '#fbbf24', '#60a5fa'],
      },
    ],
  };
});

const barOptions: ChartOptions<'bar'> = {
  plugins: { legend: { display: false } },
  scales: { x: { ticks: { color: '#cfd3e4' } }, y: { ticks: { color: '#cfd3e4' } } },
};

const doughnutOptions: ChartOptions<'doughnut'> = {
  plugins: { legend: { position: 'bottom', labels: { color: '#cfd3e4' } } },
};

const insights = computed(() => {
  if (!overview.value) return [] as string[];
  const lines: string[] = [];

  const typeEntries = Object.entries(overview.value.byType ?? {}).filter(([, v]) => v > 0);
  if (typeEntries.length) {
    const topEntry = typeEntries.sort((a, b) => b[1] - a[1])[0] as [string, number];
    const [topType] = topEntry;
    const typeLabel =
      topType === 'movie'
        ? 'фильмы'
        : topType === 'tv'
          ? 'сериалы'
          : topType === 'anime'
            ? 'аниме'
            : 'мультфильмы';
    lines.push(`Чаще всего вы смотрите ${typeLabel}.`);
  }

  if (overview.value.topGenre) {
    lines.push(`Ваш любимый жанр — «${overview.value.topGenre}».`);
  }

  if (overview.value.topCountry) {
    lines.push(`Чаще всего вы выбираете тайтлы из страны ${overview.value.topCountry}.`);
  }

  if (overview.value.averageRating) {
    lines.push(`Ваша средняя оценка — ${overview.value.averageRating.toFixed(1)}.`);
  }

  return lines;
});

const overrideScale = (value: number) => 0.5 + (value / 100) * 1.0; // 0.5–1.5
const overrideLabel = (value: number) => {
  if (value < 40) return 'Чуть слабее в подборке';
  if (value > 60) return 'Сильнее влияет на рекомендации';
  return 'Баланс, как сейчас';
};

const buildEditorCard = (item: RecommendationItemResponse): EditorRecCard => {
  const year = item.title.releaseDate ? new Date(item.title.releaseDate).getFullYear() : null;
  const metaParts: string[] = [];
  if (year) metaParts.push(String(year));
  if (item.title.tmdbRating) metaParts.push(`TMDB ${item.title.tmdbRating.toFixed(1)}`);
  metaParts.push(
    item.title.mediaType === 'movie'
      ? 'Фильм'
      : item.title.mediaType === 'tv'
        ? 'Сериал'
        : 'Тайтл',
  );
  const secondary = [
    item.title.countries?.slice(0, 2).join(', '),
    item.title.runtime ? `${item.title.runtime} мин` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const status = item.userState?.status ?? null;
  const liked = item.userState?.liked ?? false;
  const disliked = item.userState?.disliked ?? false;

  const statusLabel =
    disliked || status === ('dropped' as TitleStatus)
      ? 'В антисписке'
      : status === ('watched' as TitleStatus)
        ? 'Смотрел'
        : status === ('watching' as TitleStatus)
          ? 'Смотрю'
          : status === ('planned' as TitleStatus) || liked
            ? 'В списке'
            : undefined;

  const tags: string[] = [];
  if (item.title.genres?.length) tags.push(...item.title.genres.slice(0, 2));
  const country = item.title.countries?.[0];
  if (country) tags.push(country);

  const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

  return {
    id: item.title.id,
    tmdbId: item.title.tmdbId,
    mediaType: item.title.mediaType,
    displayTitle: item.title.russianTitle || item.title.originalTitle,
    meta: metaParts.join(' · '),
    secondaryMeta: secondary,
    tags,
    poster: item.title.posterPath ? `${TMDB_IMAGE_BASE}${item.title.posterPath}` : null,
    explanation: item.explanation,
    statusLabel,
    canAddToWatchlist:
      !item.userState ||
      (!liked &&
        !disliked &&
        status !== ('planned' as TitleStatus) &&
        status !== ('watching' as TitleStatus) &&
        status !== ('watched' as TitleStatus)),
  };
};

const loadEditorRecs = async () => {
  editorLoading.value = true;
  try {
    const data = await fetchRecommendations({
      limit: 5,
      overrideGenre: overrideScale(genreOverride.value),
      overrideMood: overrideScale(moodOverride.value),
      overrideNovelty: overrideScale(noveltyOverride.value),
      overrideDecade: overrideScale(decadeOverride.value),
      overrideCountry: overrideScale(countryOverride.value),
      overridePeople: overrideScale(peopleOverride.value),
    });
    editorRecs.value = data.items.map(buildEditorCard);
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось обновить подборку',
      life: 3000,
    });
  } finally {
    editorLoading.value = false;
  }
};

const handleEditorAddToWatchlist = async (item: EditorRecCard) => {
  try {
    await createUserTitle({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      status: 'planned',
      source: 'recommendation',
    });
    editorRecs.value = editorRecs.value.map((rec) =>
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
      summary: 'Добавлено',
      detail: 'Тайтл в списке к просмотру',
      life: 2200,
    });
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось добавить',
      life: 2600,
    });
  }
};

const openEditorDetails = (item: EditorRecCard) => {
  router.push({ path: `/title/${item.id}` });
};

const handleEditorLike = (_item: EditorRecCard) => {
  toast.add({
    severity: 'info',
    summary: 'Лайк для редактора вкуса',
    detail: 'Подборка будет переобучена через стандартный экран рекомендаций.',
    life: 2500,
  });
};

const handleEditorWatched = (_item: EditorRecCard) => {
  toast.add({
    severity: 'info',
    summary: 'Смотрел',
    detail: 'Отметьте просмотр через экран рекомендаций или истории.',
    life: 2500,
  });
};

const handleEditorDislike = (_item: EditorRecCard) => {
  toast.add({
    severity: 'info',
    summary: 'Дизлайк',
    detail: 'Используйте дизлайк на карточке рекомендаций для обучения антисписка.',
    life: 2500,
  });
};

const openGalaxyTitle = (id: string) => {
  router.push({ path: `/title/${id}` });
};

</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.kpi .stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat {
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  padding: 12px;
  border-radius: 12px;
}

.value {
  font-size: 22px;
  font-weight: 700;
}
.label {
  color: var(--text-secondary);
}

.insights {
  margin-top: 14px;
}

.insights-title {
  font-size: 14px;
  margin-bottom: 6px;
}

.insights ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 13px;
}

.chart-skeleton {
  display: grid;
  gap: 10px;
}

.empty {
  color: var(--text-secondary);
}

.anti {
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.anti-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.anti-title {
  font-weight: 500;
}

.taste-caption {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.editor {
  grid-column: 1 / -1;
}

.editor-caption {
  margin: 0 0 10px;
  color: var(--text-secondary);
  font-size: 13px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.editor-field label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.editor-field small {
  color: var(--text-secondary);
}

.editor-actions {
  margin-top: 10px;
}

.editor-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}
</style>
