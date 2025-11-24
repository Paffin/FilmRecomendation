<template>
  <div class="grid">
    <div class="surface-card kpi">
      <h2 class="section-title">{{ t('profile.title') }}</h2>
      <div class="stats" v-if="!loading && overview">
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
      <div class="stats" v-else>
        <Skeleton height="48px" borderRadius="14px" v-for="i in 6" :key="i" />
      </div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">{{ t('profile.tasteMap') }}</h3>
      <div v-if="loading" class="chart-skeleton">
        <Skeleton height="280px" borderRadius="14px" />
      </div>
      <Radar
        v-else-if="taste"
        :data="tasteRadarData"
        :options="{ scales: { r: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { display: false } } } }"
      />
      <div v-else class="empty">Нет данных — отметьте просмотренные тайтлы</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Жанры</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="220px" borderRadius="14px" /></div>
      <Bar v-else-if="taste && genreChartData.labels.length" :data="genreChartData" :options="barOptions" />
      <div v-else class="empty">Пока нет статистики</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Страны</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="220px" borderRadius="14px" /></div>
      <Doughnut v-else-if="taste && countryChartData.labels.length" :data="countryChartData" :options="doughnutOptions" />
      <div v-else class="empty">Недостаточно данных</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">{{ t('profile.antiList') }}</h3>
      <div v-if="loading" class="chart-skeleton"><Skeleton height="120px" borderRadius="12px" /></div>
      <ul v-else-if="taste && taste.antiList.length" class="anti">
        <li v-for="item in taste.antiList" :key="item.id">{{ item.title }}</li>
      </ul>
      <div v-else class="empty">Вы ещё не добавляли тайтлы в антисписок</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Skeleton from 'primevue/skeleton';
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
import { getOverview, getTasteMap } from '../../api/analytics';
import type { OverviewResponse, TasteMapResponse } from '../../api/analytics';
import { useI18n } from 'vue-i18n';

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
const { t } = useI18n();

onMounted(async () => {
  try {
    const [o, t] = await Promise.all([getOverview(), getTasteMap()]);
    overview.value = o;
    taste.value = t;
  } finally {
    loading.value = false;
  }
});

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
</style>
