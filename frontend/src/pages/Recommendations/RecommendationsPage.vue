<template>
  <div class="surface-card rec-shell">
    <div class="top">
      <div>
        <p class="eyebrow">{{ t('recommendations.modeTitle') }}</p>
        <h2 class="section-title">{{ t('recommendations.todayWant') }}</h2>
        <p class="subtitle">
          Каждый лайк, дизлайк и «Смотрел» мгновенно переобучает подборку под ваш текущий настрой.
        </p>
        <p class="context-hint">
          {{ t('recommendations.contextHint') }}
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
          <div>
            <label>{{ t('recommendations.diversity') }}</label>
            <Dropdown
              v-model="diversityLevel"
              :options="diversityOptions"
              option-label="label"
              option-value="value"
            />
          </div>
        </div>

        <div class="mixer surface-card">
          <div class="mixer-header">
            <div>
              <p class="eyebrow">Taste Mixer</p>
              <h3 class="section-title">Соберите подачу под настроение</h3>
            </div>
            <div class="mixer-tags">
              <Tag :value="mixerRiskLabel" />
              <Tag :value="mixerNoveltyLabel" />
              <Tag :value="mixerTypeLabel" />
            </div>
          </div>
          <div class="mixer-grid">
            <div>
              <label>Риск / качество</label>
              <Slider v-model="mixerRisk" :min="0" :max="100" :step="1" />
              <small>{{ mixerRiskLabel }}</small>
            </div>
            <div>
              <label>Узнаваемое ↔ Новое</label>
              <Slider v-model="mixerNovelty" :min="0" :max="100" :step="1" />
              <small>{{ mixerNoveltyLabel }}</small>
            </div>
            <div>
              <label>Кино ↔ Сериалы/аниме</label>
              <Slider v-model="mixerTypeTilt" :min="0" :max="100" :step="1" />
              <small>{{ mixerTypeLabel }}</small>
            </div>
            <div class="mixer-actions">
              <Button label="Перемешать выдачу" icon="pi pi-sparkles" size="small" @click="load" />
              <small class="hint">Taste Mixer меняет веса движка без сброса сессии.</small>
            </div>
          </div>
        </div>
      </div>
      <div class="top-actions">
        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          :loading="loading"
          @click="load"
        />
        <Button
          size="small"
          outlined
          icon="pi pi-window-maximize"
          :severity="focusMode ? 'primary' : 'secondary'"
          :label="focusMode ? 'Режим списка' : 'Режим фокуса'"
          @click="toggleFocusMode"
        />
      </div>
    </div>

    <div v-if="contextTags.length" class="context-tags surface-card">
      <Tag v-for="tag in contextTags" :key="tag" :value="tag" />
    </div>

    <div v-if="contextPresets.length" class="presets">
      <span class="presets-label">Часто удачные режимы:</span>
      <Button
        v-for="preset in contextPresets"
        :key="preset.id"
        size="small"
        text
        :label="preset.label"
        @click="applyPreset(preset)"
      />
    </div>

    <div v-if="loading" class="list">
      <Skeleton v-for="n in 5" :key="n" height="240px" border-radius="16px" />
    </div>
    <div v-else>
      <div v-if="focusMode" class="focus-wrapper">
        <div v-if="!currentFocus" class="empty">
          Нет рекомендаций — обновите подборку, чтобы начать режим фокуса.
        </div>
        <div v-else class="focus-card">
          <RecommendationCard
            :title="currentFocus.displayTitle"
            :meta="currentFocus.meta"
            :secondary-meta="currentFocus.secondaryMeta"
            :tags="currentFocus.tags"
            :poster="currentFocus.poster"
            :explanation="currentFocus.explanation"
            :status-label="currentFocus.statusLabel"
            :can-add-to-watchlist="currentFocus.canAddToWatchlist"
            :origin="currentFocus.origin"
            :busy="actionLoading === currentFocus.id"
            :show-what-if="true"
            @like="like(currentFocus)"
          @watched="watched(currentFocus)"
          @dislike="dislike(currentFocus)"
          @details="openDetails(currentFocus)"
          @add-to-watchlist="addToWatchlist(currentFocus)"
          @tweak="tweak(currentFocus, $event)"
          @why-not="loadWhyNot(currentFocus)"
        />
        <div v-if="whyNot[currentFocus.id]?.length" class="why-not">
          <div class="why-not-title">Почти попали:</div>
          <div class="why-not-list">
            <div v-for="alt in whyNot[currentFocus.id]" :key="alt.id" class="why-not-card">
              <div class="why-not-head">
                <span class="why-not-name">{{ alt.displayTitle }}</span>
                <small class="why-not-meta">{{ alt.meta }}</small>
              </div>
              <ul class="why-not-reasons">
                <li v-for="reason in alt.explanation.slice(0, 2)" :key="reason">{{ reason }}</li>
              </ul>
              <div class="why-not-actions">
                <Button size="small" text label="Детали" @click="openDetails(alt)" />
                <Button size="small" text icon="pi pi-arrow-right" label="Заменить" @click="replaceCard(currentFocus, alt)" />
              </div>
            </div>
          </div>
        </div>
        <div class="focus-actions">
          <Button
            size="small"
            text
            label="Следующая рекомендация"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="nextFocus"
            />
            <Button size="small" text label="К списку" icon="pi pi-list" @click="toggleFocusMode" />
          </div>
        </div>
      </div>
      <TransitionGroup v-else name="rec-fade" tag="div" class="list">
        <div v-if="recommendations.length === 0" class="empty">{{ t('recommendations.empty') }}</div>
        <div v-for="item in recommendations" :key="item.id" class="rec-with-why">
          <RecommendationCard
            :title="item.displayTitle"
            :meta="item.meta"
            :secondary-meta="item.secondaryMeta"
            :tags="item.tags"
            :poster="item.poster"
            :explanation="item.explanation"
            :status-label="item.statusLabel"
            :can-add-to-watchlist="item.canAddToWatchlist"
            :origin="item.origin"
            :busy="actionLoading === item.id"
            :show-what-if="true"
            @like="like(item)"
            @watched="watched(item)"
            @dislike="dislike(item)"
            @details="openDetails(item)"
            @add-to-watchlist="addToWatchlist(item)"
            @tweak="tweak(item, $event)"
            @why-not="loadWhyNot(item)"
          />
          <div v-if="whyNot[item.id]?.length" class="why-not">
            <div class="why-not-title">Почти попали:</div>
            <div class="why-not-list">
              <div v-for="alt in whyNot[item.id]" :key="alt.id" class="why-not-card">
                <div class="why-not-head">
                  <span class="why-not-name">{{ alt.displayTitle }}</span>
                  <small class="why-not-meta">{{ alt.meta }}</small>
                </div>
                <ul class="why-not-reasons">
                  <li v-for="reason in alt.explanation.slice(0, 2)" :key="reason">{{ reason }}</li>
                </ul>
                <div class="why-not-actions">
                  <Button size="small" text label="Детали" @click="openDetails(alt)" />
                  <Button size="small" text icon="pi pi-arrow-right" label="Заменить" @click="replaceCard(item, alt)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="evening-block">
      <div class="evening-header">
        <h3 class="section-title">Программа вечера</h3>
        <Button
          label="Собрать программу"
          icon="pi pi-sparkles"
          size="small"
          :loading="eveningLoading"
          @click="loadEveningProgram"
        />
      </div>
      <div v-if="eveningLoading && eveningProgram.length === 0" class="list">
        <Skeleton v-for="n in 3" :key="n" height="220px" border-radius="16px" />
      </div>
      <div v-else-if="!eveningLoading && eveningProgram.length === 0" class="empty">
        Нажмите «Собрать программу», чтобы получить связку «разогрев → основной фильм → десерт».
      </div>
      <div v-else class="list">
        <RecommendationCard
          v-for="item in eveningProgram"
          :key="item.id + item.role"
          :title="item.displayTitle"
          :meta="item.meta"
          :secondary-meta="item.secondaryMeta"
          :tags="[roleLabel(item.role), ...item.tags]"
          :poster="item.poster"
          :explanation="item.explanation"
          :status-label="item.statusLabel"
          :can-add-to-watchlist="item.canAddToWatchlist"
          :origin="item.origin"
          :busy="false"
          @like="like(item)"
          @watched="watched(item)"
          @dislike="dislike(item)"
          @details="openDetails(item)"
          @add-to-watchlist="addToWatchlist(item)"
        />
      </div>
    </div>
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
import {
  fetchRecommendations,
  fetchEveningProgram,
  sendRecommendationFeedback,
  sendRecommendationTweak,
  fetchWhyNot,
} from '../../api/recommendations';
import type {
  ApiTitle,
  MediaType,
  RecommendationItemResponse,
  TitleStatus,
  EveningProgramItemResponse,
} from '../../api/types';
import { getContextPresets } from '../../api/analytics';
import type { ContextPresetResponse } from '../../api/analytics';
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
  origin?: string;
}

interface EveningRecCard extends RecCard {
  role: 'warmup' | 'main' | 'dessert';
}

interface TweakPayload {
  runtime: 'shorter' | 'longer' | null;
  tone: 'lighter' | 'heavier' | null;
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
const diversityLevel = ref<'soft' | 'balanced' | 'bold'>('balanced');
const mixerRisk = ref(50);
const mixerNovelty = ref(50);
const mixerTypeTilt = ref(50);
const contextPresets = ref<ContextPresetResponse[]>([]);
const eveningProgram = ref<EveningRecCard[]>([]);
const eveningLoading = ref(false);
const focusMode = ref(false);
const focusIndex = ref(0);
const whyNot = ref<Record<string, RecCard[]>>({});
const whyNotLoading = ref<Record<string, boolean>>({});

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
const diversityOptions = [
  { label: 'Мягкая диверсификация', value: 'soft' },
  { label: 'Сбалансированно', value: 'balanced' },
  { label: 'Смело и разнообразно', value: 'bold' },
];

const moodLabel = computed(() => (mood.value < 40 ? 'Лёгкое' : mood.value > 70 ? 'Тяжёлое' : 'Нейтральное'));
const mindsetLabel = computed(() =>
  mindset.value < 40 ? 'Расслабиться' : mindset.value > 70 ? 'Подумать' : 'Можно и так, и так',
);
const moodParam = computed(() => (mood.value < 40 ? 'light' : mood.value > 70 ? 'heavy' : 'neutral'));
const mindsetParam = computed(() => (mindset.value < 40 ? 'relax' : mindset.value > 70 ? 'focus' : 'balanced'));
const mixerRiskLabel = computed(() => (mixerRisk.value < 40 ? 'Безопасно' : mixerRisk.value > 70 ? 'Остро' : 'Сбалансировано'));
const mixerNoveltyLabel = computed(() => (mixerNovelty.value < 40 ? 'Знакомое' : mixerNovelty.value > 70 ? 'Сюрпризы' : 'Смешать'));
const mixerTypeLabel = computed(() => (mixerTypeTilt.value < 40 ? 'Больше кино' : mixerTypeTilt.value > 60 ? 'Больше сериалов/аниме' : 'Баланс'));
const contextTags = computed(() => [
  moodParam.value === 'light' ? 'Лёгкое' : moodParam.value === 'heavy' ? 'Тяжёлое' : 'Нейтральное',
  mindsetParam.value === 'relax' ? 'Расслабиться' : mindsetParam.value === 'focus' ? 'Подумать' : 'Баланс',
  companies.find((c) => c.value === company.value)?.label ?? '',
  times.find((t) => t.value === timeAvailable.value)?.label ?? '',
  noveltyOptions.find((n) => n.value === noveltyBias.value)?.label ?? '',
  paceOptions.find((p) => p.value === pace.value)?.label ?? '',
  freshnessOptions.find((f) => f.value === freshness.value)?.label ?? '',
  mixerRiskLabel.value,
  mixerNoveltyLabel.value,
  mixerTypeLabel.value,
].filter(Boolean));

const applyPreset = (preset: ContextPresetResponse) => {
  if (preset.mood === 'light') mood.value = 25;
  else if (preset.mood === 'heavy') mood.value = 80;
  else if (preset.mood === 'neutral') mood.value = 50;

  if (preset.mindset === 'relax') mindset.value = 25;
  else if (preset.mindset === 'focus') mindset.value = 80;
  else if (preset.mindset === 'balanced') mindset.value = 50;

  if (preset.company) company.value = preset.company;
  if (preset.timeAvailable) timeAvailable.value = preset.timeAvailable;
  if (preset.noveltyBias) noveltyBias.value = preset.noveltyBias;
  if (preset.pace) pace.value = preset.pace;
  if (preset.freshness) freshness.value = preset.freshness;

  load();
};

const loadContextPresets = async () => {
  try {
    contextPresets.value = await getContextPresets();
  } catch {
    // тихо игнорируем ошибки — пресеты опциональны
  }
};

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
    origin: item.origin,
  };
};

const mapEveningItemToCard = (item: EveningProgramItemResponse): EveningRecCard => {
  const base = mapToCard(item);
  return {
    ...base,
    role: item.role,
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
      diversityLevel: diversityLevel.value,
      mixerRisk: mixerRisk.value,
      mixerNovelty: mixerNovelty.value,
      mixerTypeTilt: mixerTypeTilt.value,
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

const loadWhyNot = async (item: RecCard) => {
  if (!sessionId.value) return;
  whyNotLoading.value[item.id] = true;
  try {
    const res = await fetchWhyNot({ sessionId: sessionId.value, titleId: item.id });
    whyNot.value[item.id] = (res.items ?? []).map(mapToCard);
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Не удалось показать альтернативы', life: 3000 });
  } finally {
    whyNotLoading.value[item.id] = false;
  }
};

const replaceCard = (original: RecCard, replacement: RecCard) => {
  const index = recommendations.value.findIndex((r) => r.id === original.id);
  if (index >= 0) {
    recommendations.value.splice(index, 1, replacement);
  }
};

const tweak = async (item: RecCard, payload: TweakPayload) => {
  if (!sessionId.value) return;
  if (!payload.runtime && !payload.tone) return;
  actionLoading.value = item.id;
  try {
    const res = await sendRecommendationTweak({
      sessionId: sessionId.value,
      titleId: item.id,
      runtime: payload.runtime ?? undefined,
      tone: payload.tone ?? undefined,
    });
    const replacement = res?.replacement ? mapToCard(res.replacement) : null;
    const index = recommendations.value.findIndex((r) => r.id === item.id);
    if (index >= 0 && replacement) {
      recommendations.value.splice(index, 1, replacement);
    }
    if (replacement) {
      toast.add({
        severity: 'info',
        summary: 'Подборка обновлена',
        detail: 'Мы предложили вариант под скорректированный запрос.',
        life: 2500,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось обновить рекомендацию',
      detail: 'Попробуйте ещё раз',
      life: 3500,
    });
  } finally {
    actionLoading.value = null;
  }
};

const loadEveningProgram = async () => {
  eveningLoading.value = true;
  try {
    const data = await fetchEveningProgram({
      limit: 9,
      mood: moodParam.value,
      mindset: mindsetParam.value,
      company: company.value,
      timeAvailable: timeAvailable.value,
      noveltyBias: noveltyBias.value,
      pace: pace.value,
      freshness: freshness.value,
      diversityLevel: diversityLevel.value,
      mixerRisk: mixerRisk.value,
      mixerNovelty: mixerNovelty.value,
      mixerTypeTilt: mixerTypeTilt.value,
    });
    eveningProgram.value = data.items.map(mapEveningItemToCard);
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Не удалось собрать программу вечера',
      life: 3500,
    });
  } finally {
    eveningLoading.value = false;
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

const roleLabel = (role: 'warmup' | 'main' | 'dessert') => {
  if (role === 'warmup') return 'Разогрев';
  if (role === 'dessert') return 'На десерт';
  return 'Основной';
};

onMounted(() => {
  load();
  loadContextPresets();
});

const currentFocus = computed(() => {
  if (!recommendations.value.length) return null;
  const idx = Math.min(focusIndex.value, recommendations.value.length - 1);
  return recommendations.value[idx];
});

const toggleFocusMode = () => {
  focusMode.value = !focusMode.value;
  if (focusMode.value) {
    focusIndex.value = 0;
  }
};

const nextFocus = () => {
  if (!recommendations.value.length) return;
  focusIndex.value = (focusIndex.value + 1) % recommendations.value.length;
};
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

.top-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.mixer {
  margin-top: 16px;
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(138, 180, 255, 0.08), rgba(255, 73, 167, 0.06));
  border: 1px solid rgba(138, 180, 255, 0.16);
}

.mixer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mixer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px 18px;
  margin-top: 10px;
}

.mixer-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mixer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mixer .hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.list {
  margin-top: 16px;
  display: grid;
  gap: 14px;
}

.rec-with-why {
  display: grid;
  gap: 8px;
}

.context-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 4px;
  align-items: center;
}

.presets-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
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

.context-hint {
  margin: 0 0 10px;
  color: var(--text-secondary);
  font-size: 13px;
  opacity: 0.9;
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

.focus-wrapper {
  margin-top: 16px;
}

.focus-card {
  max-width: 780px;
  margin: 0 auto;
}

.why-not {
  margin-top: 10px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  display: grid;
  gap: 8px;
}

.why-not-title {
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.why-not-list {
  display: grid;
  gap: 8px;
}

.why-not-card {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.why-not-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: baseline;
}

.why-not-name {
  font-weight: 600;
}

.why-not-meta {
  color: var(--text-secondary);
}

.why-not-reasons {
  margin: 6px 0 4px;
  padding-left: 16px;
  color: var(--text-secondary);
}

.why-not-actions {
  display: flex;
  gap: 6px;
}

.focus-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 768px) {
  .top {
    flex-direction: column;
    align-items: stretch;
  }

  .rec-shell {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .list {
    margin-top: 12px;
  }
}
</style>
