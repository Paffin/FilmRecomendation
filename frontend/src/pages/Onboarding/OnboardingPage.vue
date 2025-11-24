<template>
  <div class="surface-card onboarding">
    <h2 class="section-title">Онбординг вкуса</h2>
    <div class="step">
      <h3>Типы контента</h3>
      <div class="chips">
        <ToggleButton v-for="type in types" :key="type.value" v-model="type.selected" :on-label="type.label" :off-label="type.label" />
      </div>
    </div>

    <div class="step">
      <h3>Отметьте, что уже смотрели</h3>
      <div class="search-row">
        <span class="p-input-icon-left w-full">
          <i class="pi pi-search" />
          <InputText v-model="query" placeholder="Найдите фильм, сериал или аниме" class="w-full" />
        </span>
        <Button label="Искать" :loading="searching" @click="search" />
      </div>
      <div class="card-grid">
        <Skeleton v-for="i in 6" v-if="loading" :key="i" height="220px" border-radius="12px" />
        <div v-else-if="results.length === 0" class="empty">Начните поиск, чтобы отметить просмотренное.</div>
        <TitleCard
          v-for="item in results"
          v-else
          :key="item.tmdbId"
          :title="{
            id: item.tmdbId,
            name: item.title,
            year: item.year,
            genres: item.genres,
            poster: item.poster,
            selected: selected.has(item.tmdbId),
          }"
          @mark="() => toggleWatched(item)"
        />
      </div>
    </div>

    <div class="footer">
      <div>Отмечено: {{ selectedCount }}</div>
      <Button label="Завершить" severity="success" :loading="saving" :disabled="selectedCount < 5" @click="complete" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ToggleButton from 'primevue/togglebutton';
import Skeleton from 'primevue/skeleton';
import { useRouter } from 'vue-router';
import TitleCard from '../../components/common/TitleCard.vue';
import { useToast } from 'primevue/usetoast';
import type { MediaType } from '../../api/types';
import { searchTitles } from '../../api/titles';
import { createUserTitle } from '../../api/userTitles';
import { completeOnboarding } from '../../api/users';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const router = useRouter();
const query = ref('');
const loading = ref(false);
const searching = ref(false);
const saving = ref(false);
const results = ref<SearchItem[]>([]);
const selected = reactive(new Map<number, SearchItem>());
const toast = useToast();

interface SearchItem {
  tmdbId: number;
  title: string;
  year?: string;
  genres?: string[];
  mediaType: MediaType;
  poster?: string | null;
}

const types = reactive([
  { label: 'Фильмы', value: 'movie', selected: true },
  { label: 'Сериалы', value: 'tv', selected: true },
  { label: 'Аниме', value: 'anime', selected: false },
  { label: 'Мультфильмы', value: 'cartoon', selected: false },
]);

const selectedCount = computed(() => selected.size);
const activeType = computed<MediaType | undefined>(() => {
  const active = types.filter((t) => t.selected).map((t) => t.value as MediaType);
  if (active.length === 1) return active[0];
  return undefined;
});

const search = async () => {
  if (!query.value.trim()) return;
  loading.value = true;
  searching.value = true;
  try {
    const data = await searchTitles(query.value, activeType.value);
    results.value = data.results.map((r) => ({
      tmdbId: r.id,
      title: r.title || r.name || 'Без названия',
      year: (r.release_date || r.first_air_date || '').slice(0, 4) || undefined,
      genres: [],
      mediaType: mapMediaType(r.media_type ?? activeType.value),
      poster: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
    }));
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ошибка поиска', detail: 'Не удалось найти тайтлы', life: 4000 });
  } finally {
    loading.value = false;
    searching.value = false;
  }
};

const toggleWatched = (item: SearchItem) => {
  if (selected.has(item.tmdbId)) {
    selected.delete(item.tmdbId);
  } else {
    selected.set(item.tmdbId, item);
  }
};

const complete = async () => {
  if (selected.size === 0) return;
  saving.value = true;
  try {
    await Promise.all(
      Array.from(selected.values()).map((item) =>
        createUserTitle({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          status: 'watched',
          source: 'onboarding',
          liked: true,
        }),
      ),
    );
    await completeOnboarding();
    toast.add({ severity: 'success', summary: 'Готово', detail: 'Мы настроили ваш профиль вкуса', life: 2500 });
    router.push('/recommendations');
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось сохранить', detail: 'Попробуйте позже', life: 4000 });
  } finally {
    saving.value = false;
  }
};

const mapMediaType = (value?: string | MediaType): MediaType => {
  if (value === 'movie') return 'movie';
  if (value === 'anime') return 'anime';
  if (value === 'cartoon') return 'cartoon';
  return 'tv'; // TMDB не различает аниме/мультфильмы, мапим в tv
};
</script>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step {
  background: var(--surface-2);
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.search-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.empty {
  color: var(--text-secondary);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
