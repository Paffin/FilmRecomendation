<template>
  <div class="surface-card onboarding">
    <h2 class="section-title">Онбординг вкуса</h2>
    <p class="subtitle">
      Сначала выберем типы контента, затем отметим просмотренное и оценим любимые тайтлы — так рекомендации станут точнее уже с первой подборки.
    </p>

    <div class="stepper">
      <div class="step-pill" :class="{ active: step === 1, done: step > 1 }">
        <span class="step-index">1</span>
        <span class="step-label">Типы контента</span>
      </div>
      <div class="step-pill" :class="{ active: step === 2, done: step > 2 }">
        <span class="step-index">2</span>
        <span class="step-label">Смотрели</span>
      </div>
      <div class="step-pill" :class="{ active: step === 3 }">
        <span class="step-index">3</span>
        <span class="step-label">Оценка</span>
      </div>
    </div>

    <div v-if="step === 1" class="step">
      <h3>Типы контента</h3>
      <p class="step-hint">
        Отметьте форматы, которые вам интересны. Это поможет сузить первую подборку.
      </p>
      <div class="chips">
        <ToggleButton
          v-for="type in types"
          :key="type.value"
          v-model="type.selected"
          :on-label="type.label"
          :off-label="type.label"
        />
      </div>
    </div>

    <div v-else-if="step === 2" class="step">
      <h3>Отметьте тайтлы, которые вы уже смотрели</h3>
      <div class="progress-row">
        <div class="progress-label">Минимум 10 тайтлов со статусом «Смотрел»</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: watchedProgress + '%' }" />
        </div>
        <div class="progress-count">{{ watchedCount }} / 10</div>
      </div>

      <div class="search-row">
        <span class="p-input-icon-left w-full">
          <i class="pi pi-search" />
          <InputText
            v-model="query"
            placeholder="Найдите фильм, сериал или аниме"
            class="w-full"
          />
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
            selected: selections.has(item.tmdbId),
          }"
          mode="watched"
          @mark="() => markWatched(item)"
          @dislike="() => markNotWatched(item)"
          @details="() => openDetails(item)"
        />
      </TransitionGroup>
    </div>

    <div v-else class="step">
      <h3>Оцените часть из просмотренного</h3>
      <p class="step-hint">
        Поставьте хотя бы 5 лайков или дизлайков — так мы лучше поймём ваш вкус.
      </p>
      <div class="progress-row">
        <div class="progress-label">Минимум 5 оценённых тайтлов</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: ratedProgress + '%' }" />
        </div>
        <div class="progress-count">{{ ratedCount }} / 5</div>
      </div>

      <div v-if="watchedSelections.length === 0" class="empty">
        Пока нет отмеченных «Смотрел». Вернитесь на шаг назад и добавьте несколько тайтлов.
      </div>
      <TransitionGroup v-else name="onb-fade" tag="div" class="card-grid">
        <TitleCard
          v-for="item in watchedSelections"
          :key="item.tmdbId"
          :title="{
            id: item.tmdbId,
            name: item.title,
            year: item.year,
            genres: item.genres,
            poster: item.poster,
            selected: item.liked === true,
            disliked: item.liked === false,
          }"
          @mark="() => toggleLike(item.tmdbId)"
          @dislike="() => toggleDislike(item.tmdbId)"
          @details="() => openDetailsSelection(item.tmdbId)"
        />
      </TransitionGroup>
    </div>

    <div class="footer">
      <div class="footer-left">
        <Button v-if="step > 1" label="Назад" text size="small" @click="prevStep" />
        <span class="step-caption">Шаг {{ step }} из 3</span>
      </div>
      <div class="footer-actions">
        <Button
          v-if="step < 3"
          label="Дальше"
          severity="primary"
          :disabled="(step === 1 && !hasAnyTypeSelected) || (step === 2 && watchedCount < 10)"
          @click="nextStep"
        />
        <Button
          v-else
          label="Завершить"
          severity="success"
          :loading="saving"
          :disabled="ratedCount < 5"
          @click="complete"
        />
      </div>
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
const toast = useToast();

const step = ref<1 | 2 | 3>(1);
const query = ref('');
const loading = ref(false);
const searching = ref(false);
const saving = ref(false);
const results = ref<SearchItem[]>([]);

interface SearchItem {
  tmdbId: number;
  title: string;
  year?: string;
  genres?: string[];
  mediaType: MediaType;
  poster?: string | null;
}

interface SelectionState extends SearchItem {
  liked: boolean | null;
}

const selections = reactive(new Map<number, SelectionState>());

const types = reactive([
  { label: 'Фильмы', value: 'movie', selected: true },
  { label: 'Сериалы', value: 'tv', selected: true },
  { label: 'Аниме', value: 'anime', selected: false },
  { label: 'Мультфильмы', value: 'cartoon', selected: false },
]);

const activeType = computed<MediaType | undefined>(() => {
  const active = types.filter((t) => t.selected).map((t) => t.value as MediaType);
  if (active.length === 1) return active[0];
  return undefined;
});

const hasAnyTypeSelected = computed(() => types.some((t) => t.selected));

const watchedCount = computed(() => selections.size);
const watchedProgress = computed(() =>
  Math.min(100, Math.round((watchedCount.value / 10) * 100)),
);
const watchedSelections = computed(() => Array.from(selections.values()));
const ratedCount = computed(
  () => watchedSelections.value.filter((item) => item.liked !== null).length,
);
const ratedProgress = computed(() =>
  Math.min(100, Math.round((ratedCount.value / 5) * 100)),
);

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
    toast.add({
      severity: 'error',
      summary: 'Ошибка поиска',
      detail: 'Не удалось найти тайтлы',
      life: 4000,
    });
  } finally {
    loading.value = false;
    searching.value = false;
  }
};

const markWatched = (item: SearchItem) => {
  const existing = selections.get(item.tmdbId);
  if (existing) {
    selections.delete(item.tmdbId);
  } else {
    selections.set(item.tmdbId, {
      ...item,
      liked: null,
    });
  }
};

const markNotWatched = (item: SearchItem) => {
  selections.delete(item.tmdbId);
};

const toggleLike = (tmdbId: number) => {
  const existing = selections.get(tmdbId);
  if (!existing) return;
  const nextLiked = existing.liked === true ? null : true;
  selections.set(tmdbId, { ...existing, liked: nextLiked });
};

const toggleDislike = (tmdbId: number) => {
  const existing = selections.get(tmdbId);
  if (!existing) return;
  const nextLiked = existing.liked === false ? null : false;
  selections.set(tmdbId, { ...existing, liked: nextLiked });
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

const openDetailsSelection = async (tmdbId: number) => {
  const selection = selections.get(tmdbId);
  if (!selection) return;
  await openDetails(selection);
};

const complete = async () => {
  if (watchedCount.value === 0 || ratedCount.value < 5) return;
  saving.value = true;
  try {
    await Promise.all(
      Array.from(selections.values()).map((item) =>
        createUserTitle({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          status: 'watched',
          source: 'onboarding',
          liked: item.liked === true,
          disliked: item.liked === false,
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
    toast.add({
      severity: 'success',
      summary: 'Готово',
      detail: 'Мы настроили ваш профиль вкуса',
      life: 2500,
    });
    router.push('/recommendations');
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось сохранить',
      detail: 'Попробуйте позже',
      life: 4000,
    });
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
    if (step.value >= 2 && !query.value.trim()) {
      loadInitial();
    }
  },
);

const nextStep = () => {
  if (step.value === 1) {
    step.value = 2;
    if (!results.value.length && !loading.value) {
      loadInitial();
    }
  } else if (step.value === 2 && watchedCount.value >= 10) {
    step.value = 3;
  }
};

const prevStep = () => {
  if (step.value > 1) {
    step.value -= 1;
  }
};
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

.stepper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.step-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  color: var(--text-secondary);
  font-size: 12px;
}

.step-pill.active {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, rgba(138, 180, 255, 0.4), rgba(255, 73, 167, 0.35));
  color: #ffffff;
}

.step-pill.done {
  opacity: 0.85;
}

.step-index {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  font-weight: 600;
  font-size: 12px;
}

.step-label {
  white-space: nowrap;
}

.step {
  background: var(--surface-2);
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
}

.step-hint {
  margin: 4px 0 10px;
  color: var(--text-secondary);
  font-size: 13px;
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

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 8px;
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
  margin-top: 8px;
  gap: 8px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.step-caption {
  color: var(--text-secondary);
  font-size: 13px;
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

