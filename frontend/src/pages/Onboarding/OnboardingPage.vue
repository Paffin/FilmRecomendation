<template>
  <div class="surface-card onboarding">
    <h2 class="section-title">Онбординг вкуса</h2>
    <p class="subtitle">
      Лайкайте и дизлайкайте тайтлы — так мы обучим рекомендации под ваш вкус ещё до первой подборки.
    </p>
    <div class="step">
      <h3>Типы контента</h3>
      <div class="chips">
        <ToggleButton v-for="type in types" :key="type.value" v-model="type.selected" :on-label="type.label" :off-label="type.label" />
      </div>
    </div>

    <div class="step">
      <h3>Отметьте хотя бы 5 тайтлов</h3>
      <div class="progress-row">
        <div class="progress-label">Минимум 5 тайтлов (лайк или дизлайк), дальше — без ограничений</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }" />
        </div>
        <div class="progress-count">{{ selectedCount }} / 5</div>
      </div>
      <div class="search-row">
        <span class="p-input-icon-left w-full">
          <i class="pi pi-search" />
          <InputText v-model="query" placeholder="Найдите фильм, сериал или аниме" class="w-full" />
        </span>
        <Button label="Искать" :loading="searching" @click="search" />
      </div>
      <TransitionGroup name="onb-fade" tag="div" class="card-grid">
        <Skeleton v-for="i in 5" v-if="loading" :key="i" height="220px" border-radius="12px" />
        <div v-else-if="results.length === 0" class="empty">
          Не удалось подобрать стартовые тайтлы. Попробуйте изменить тип контента или воспользоваться поиском.
        </div>
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
            disliked: selected.get(item.tmdbId)?.disliked ?? false,
          }"
          @mark="() => toggleWatched(item)"
          @dislike="() => toggleDislike(item)"
          @details="() => openDetails(item)"
        />
      </TransitionGroup>
    </div>

    <div class="footer">
      <div>Отмечено: {{ selectedCount }}</div>
      <Button label="Завершить" severity="success" :loading="saving" :disabled="selectedCount < 5" @click="complete" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ToggleButton from 'primevue/togglebutton';
import Skeleton from 'primevue/skeleton';
import { useRouter } from 'vue-router';
import TitleCard from '../../components/common/TitleCard.vue';
import { useToast } from 'primevue/usetoast';
import type { MediaType } from '../../api/types';
import { searchTitles, discoverTitles, getTitleByTmdb, type TmdbSearchResult } from '../../api/titles';
import { createUserTitle } from '../../api/userTitles';
import { completeOnboarding } from '../../api/users';
import { useAuthStore } from '../../store/auth';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'боевик',
  12: 'приключения',
  16: 'анимация',
  35: 'комедия',
  80: 'криминал',
  99: 'документальный',
  18: 'драма',
  10751: 'семейный',
  14: 'фэнтези',
  36: 'история',
  27: 'ужасы',
  10402: 'музыка',
  9648: 'детектив',
  10749: 'мелодрама',
  878: 'фантастика',
  10770: 'телефильм',
  53: 'триллер',
  10752: 'военный',
  37: 'вестерн',
};

const router = useRouter();
const auth = useAuthStore();
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
  disliked?: boolean;
}

const types = reactive([
  { label: 'Фильмы', value: 'movie', selected: true },
  { label: 'Сериалы', value: 'tv', selected: true },
  { label: 'Аниме', value: 'anime', selected: false },
  { label: 'Мультфильмы', value: 'cartoon', selected: false },
]);

const selectedCount = computed(() => selected.size);
const progress = computed(() => Math.min(100, Math.round((selected.size / 5) * 100)));
const activeType = computed<MediaType | undefined>(() => {
  const active = types.filter((t) => t.selected).map((t) => t.value as MediaType);
  if (active.length === 1) return active[0];
  return undefined;
});

const mapResults = (items: TmdbSearchResult[], fallbackMediaType?: MediaType): SearchItem[] =>
  items.map((r) => {
    const genres = (r.genre_ids || [])
      .map((id: number) => TMDB_GENRE_MAP[id])
      .filter((name): name is string => Boolean(name))
      .slice(0, 3);
    return {
      tmdbId: r.id,
      title: r.title || r.name || 'Без названия',
      year: (r.release_date || r.first_air_date || '').slice(0, 4) || undefined,
      genres,
      mediaType: mapMediaType(r.media_type ?? fallbackMediaType),
      poster: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
    };
  });

const loadInitial = async () => {
  loading.value = true;
  try {
    const data = await discoverTitles(activeType.value);
    // берём первые 5 тайтлов, чтобы сразу дать пользователю компактную, но разнообразную подборку
    results.value = mapResults(data.results.slice(0, 5), activeType.value);
  } catch (e) {
    results.value = [];
    toast.add({
      severity: 'warn',
      summary: 'Не удалось загрузить подборку',
      detail: 'Попробуйте выбрать другой тип или воспользоваться поиском',
      life: 3500,
    });
  } finally {
    loading.value = false;
  }
};

const search = async () => {
  if (!query.value.trim()) return;
  loading.value = true;
  searching.value = true;
  try {
    const data = await searchTitles(query.value, activeType.value);
    results.value = mapResults(data.results.slice(0, 20), activeType.value);
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
    selected.set(item.tmdbId, { ...item, disliked: false });
  }
};

const toggleDislike = (item: SearchItem) => {
  const existing = selected.get(item.tmdbId);
  if (!existing) {
    selected.set(item.tmdbId, { ...item, disliked: true });
  } else {
    const next = { ...existing, disliked: !existing.disliked };
    // если пользователь дизлайкнул, считаем выбранным; если снял дизлайк и не хотел сохранять — оставляем выбранным
    selected.set(item.tmdbId, next);
  }
};

const openDetails = async (item: SearchItem) => {
  try {
    const title = await getTitleByTmdb(item.tmdbId, item.mediaType);
    router.push({ path: `/title/${title.id}` });
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось открыть страницу тайтла',
      detail: 'Попробуйте ещё раз чуть позже',
      life: 3000,
    });
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
          liked: !item.disliked,
          disliked: item.disliked ?? false,
        }),
      ),
    );
    await completeOnboarding();
    // refresh user to unlock навигацию сразу после онбординга
    try {
      await auth.fetchMe();
    } catch (e) {
      // fetchMe уже вылогинит при ошибке, перехватываем чтобы не ломать UX
    }
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

onMounted(() => {
  loadInitial();
});

watch(
  activeType,
  () => {
    // Если пользователь ещё не ввёл запрос, обновляем витрину под выбранный тип
    if (!query.value.trim()) {
      loadInitial();
    }
  },
);
</script>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.subtitle {
  margin: 0 0 6px;
  color: var(--text-secondary);
  font-size: 14px;
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

.progress-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
  color: var(--text-secondary);
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #8ab4ff, #ff49a7);
   transition: width 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
   box-shadow: 0 0 16px rgba(138, 180, 255, 0.45);
}

.empty {
  color: var(--text-secondary);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.onb-fade-enter-active,
.onb-fade-leave-active {
  transition: all 0.25s ease-out;
}

.onb-fade-enter-from,
.onb-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
