<template>
  <div v-if="!loading && title" class="details surface-card">
    <div class="hero">
      <div class="poster" :style="posterStyle">
        <span v-if="!title.posterPath" class="placeholder">Нет постера</span>
      </div>
      <div class="info">
        <h2>{{ title.russianTitle || title.originalTitle }}</h2>
        <p class="meta">
          {{ year }} · {{ mediaLabel }}
          <span v-if="title.tmdbRating"> · TMDB {{ title.tmdbRating.toFixed(1) }}</span>
          <span v-if="title.runtime"> · {{ title.runtime }} мин</span>
        </p>
        <p class="overview">{{ title.overview }}</p>
        <div class="chips">
          <Tag v-for="g in title.genres" :key="g" :value="g" />
          <Tag v-for="c in title.countries" :key="c" severity="success" :value="c" />
        </div>
        <div class="actions">
          <Button label="В список" icon="pi pi-plus" :loading="saving" @click="addToList" />
          <Button label="Смотрел" icon="pi pi-check" severity="success" outlined :loading="saving" @click="markWatched" />
          <Button icon="pi pi-thumbs-up" severity="success" :outlined="!state?.liked" :loading="saving" @click="toggleLike" />
          <Button icon="pi pi-thumbs-down" severity="danger" :outlined="!state?.disliked" :loading="saving" @click="toggleDislike" />
        </div>
      </div>
    </div>
    <div>
      <h3 class="section-title">Похожие тайтлы</h3>
      <div class="card-grid">
        <Skeleton v-for="n in 4" v-if="similarLoading" :key="n" height="200px" border-radius="14px" />
        <div v-else-if="similar.length === 0" class="empty">Нет похожих тайтлов</div>
        <div v-for="item in similar" v-else :key="item.tmdbId" class="surface-card sim-card">
          <div class="sim-poster" :style="item.poster ? { backgroundImage: `url(${item.poster})` } : undefined"></div>
          <div class="sim-info">
            <div class="title">{{ item.title }}</div>
            <div class="meta">{{ item.meta }}</div>
            <Button label="В список" size="small" icon="pi pi-plus" @click="() => quickAdd(item)" />
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="surface-card">
    <Skeleton height="320px" border-radius="16px" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import { getTitle, getSimilar } from '../../api/titles';
import { createUserTitle, getUserTitleByTitleId, updateUserTitle } from '../../api/userTitles';
import type { ApiTitle, MediaType, UserTitleStateResponse } from '../../api/types';

const route = useRoute();
const toast = useToast();

const title = ref<ApiTitle | null>(null);
const state = ref<UserTitleStateResponse | null>(null);
const similar = ref<{ tmdbId: number; title: string; meta: string; poster: string | null; mediaType: MediaType }[]>([]);
const loading = ref(true);
const similarLoading = ref(true);
const saving = ref(false);

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const load = async () => {
  const id = route.params.id as string;
  loading.value = true;
  try {
    const [t, s] = await Promise.all([getTitle(id), getUserTitleByTitleId(id)]);
    title.value = t;
    state.value = s;
  } finally {
    loading.value = false;
  }

  fetchSimilar();
};

const fetchSimilar = async () => {
  similarLoading.value = true;
  try {
    if (!title.value) return;
    const res = await getSimilar(title.value.id);
    similar.value = (res?.results ?? []).slice(0, 8).map((item: any) => ({
      tmdbId: item.id,
      mediaType: mapMediaType(item.media_type) ?? title.value!.mediaType,
      title: item.title || item.name,
      meta: item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '—',
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
    }));
  } finally {
    similarLoading.value = false;
  }
};

const addToList = async () => {
  if (!title.value) return;
  saving.value = true;
  try {
    const created = await createUserTitle({ tmdbId: title.value.tmdbId, mediaType: title.value.mediaType, status: 'planned', source: 'manual' });
    state.value = created;
    toast.add({ severity: 'success', summary: 'Добавлено', detail: 'В списке к просмотру', life: 2200 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось добавить', life: 2500 });
  } finally {
    saving.value = false;
  }
};

const markWatched = async () => {
  if (!title.value) return;
  saving.value = true;
  try {
    const updated = state.value
      ? await updateUserTitle(state.value.id, { status: 'watched' })
      : await createUserTitle({ tmdbId: title.value.tmdbId, mediaType: title.value.mediaType, status: 'watched', source: 'manual' });
    state.value = updated;
    toast.add({ severity: 'success', summary: 'Отмечено как просмотрено', life: 2200 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось обновить', life: 2500 });
  } finally {
    saving.value = false;
  }
};

const toggleLike = async () => {
  if (!title.value) return;
  saving.value = true;
  try {
    const updated = state.value
      ? await updateUserTitle(state.value.id, { liked: !state.value.liked, disliked: false, status: 'planned' })
      : await createUserTitle({ tmdbId: title.value.tmdbId, mediaType: title.value.mediaType, status: 'planned', liked: true });
    state.value = updated;
  } finally {
    saving.value = false;
  }
};

const toggleDislike = async () => {
  if (!title.value) return;
  saving.value = true;
  try {
    const updated = state.value
      ? await updateUserTitle(state.value.id, { disliked: !state.value.disliked, liked: false, status: 'dropped' })
      : await createUserTitle({ tmdbId: title.value.tmdbId, mediaType: title.value.mediaType, status: 'dropped', disliked: true });
    state.value = updated;
  } finally {
    saving.value = false;
  }
};

const quickAdd = async (item: { tmdbId: number; mediaType: MediaType }) => {
  try {
    await createUserTitle({ tmdbId: item.tmdbId, mediaType: item.mediaType, status: 'planned', source: 'recommendation' });
    toast.add({ severity: 'success', summary: 'Добавлено', detail: 'Тайтл в списке', life: 1800 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось добавить', life: 2200 });
  }
};

const posterStyle = computed(() =>
  title.value?.posterPath
    ? { backgroundImage: `url(${TMDB_IMAGE_BASE}${title.value.posterPath})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined,
);

const year = computed(() => (title.value?.releaseDate ? new Date(title.value.releaseDate).getFullYear() : '—'));
const mediaLabel = computed(() => {
  if (!title.value) return '';
  if (title.value.mediaType === 'movie') return 'Фильм';
  if (title.value.mediaType === 'tv') return 'Сериал';
  if (title.value.mediaType === 'anime') return 'Аниме';
  return 'Тайтл';
});

const mapMediaType = (value?: string): MediaType | null => {
  if (value === 'movie') return 'movie';
  if (value === 'tv') return 'tv';
  return null;
};

onMounted(load);
</script>

<style scoped>
.details { display: flex; flex-direction: column; gap: 18px; }
.hero { display: grid; grid-template-columns: 220px 1fr; gap: 16px; }
.poster { background: linear-gradient(135deg, rgba(138,180,255,0.35), rgba(255,73,167,0.25)); border-radius: 16px; height: 320px; display: grid; place-items: center; color: var(--text-secondary); }
.placeholder { padding: 6px 12px; background: rgba(255,255,255,0.06); border-radius: 10px; }
.meta { color: var(--text-secondary); }
.overview { color: #cfd3e4; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.sim-card { display: grid; grid-template-columns: 90px 1fr; gap: 10px; align-items: center; }
.sim-poster { width: 100%; height: 120px; border-radius: 12px; background-size: cover; background-position: center; background-color: rgba(255,255,255,0.04); }
.sim-info { display: flex; flex-direction: column; gap: 6px; }
.empty { color: var(--text-secondary); }
@media (max-width: 900px) { .hero { grid-template-columns: 1fr; } .poster { height: 220px; } }
</style>
