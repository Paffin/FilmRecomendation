<template>
  <div class="rec-card surface-card">
    <div class="poster" :style="posterStyle">
      <span v-if="!poster" class="placeholder">{{ t('recommendations.noPoster') }}</span>
      <div v-else class="badge">{{ t('recommendations.cardBadge') }}</div>
    </div>
    <div class="content">
      <div class="title-row">
        <div class="title">{{ title }}</div>
        <div class="meta-block">
          <div v-if="meta" class="meta">{{ meta }}</div>
          <div v-if="secondaryMeta" class="meta subtle">{{ secondaryMeta }}</div>
          <span v-if="statusLabel" class="status-label">{{ statusLabel }}</span>
        </div>
      </div>
      <div v-if="tags?.length" class="chips">
        <Tag v-for="tag in tags" :key="tag" :value="tag" severity="info" />
      </div>
      <div v-if="explanation?.length" class="why">
        <div class="why-title">{{ t('recommendations.why') }}</div>
        <ul>
          <li v-for="reason in explanation" :key="reason">{{ reason }}</li>
        </ul>
      </div>
      <div v-if="showWhatIf" class="whatif">
        <span class="whatif-label">Что если...</span>
        <div class="whatif-row">
          <span class="whatif-chip">другой хронометраж</span>
          <Button
            size="small"
            text
            :label="'Короче'"
            :severity="runtimeTweak === 'shorter' ? 'primary' : 'secondary'"
            @click="toggleRuntime('shorter')"
          />
          <Button
            size="small"
            text
            :label="'Длиннее'"
            :severity="runtimeTweak === 'longer' ? 'primary' : 'secondary'"
            @click="toggleRuntime('longer')"
          />
        </div>
        <div class="whatif-row">
          <span class="whatif-chip">другое настроение</span>
          <Button
            size="small"
            text
            :label="'Легче'"
            :severity="toneTweak === 'lighter' ? 'primary' : 'secondary'"
            @click="toggleTone('lighter')"
          />
          <Button
            size="small"
            text
            :label="'Тяжелее'"
            :severity="toneTweak === 'heavier' ? 'primary' : 'secondary'"
            @click="toggleTone('heavier')"
          />
        </div>
      </div>
      <div class="actions">
        <Button icon="pi pi-eye" :label="t('recommendations.more')" text @click="$emit('details')" />
        <span class="spacer" />
        <Button
          v-if="canAddToWatchlist"
          icon="pi pi-bookmark"
          :label="t('recommendations.toWatchlist')"
          :disabled="busy"
          text
          @click="$emit('add-to-watchlist')"
        />
        <Button
          icon="pi pi-check-circle"
          :label="t('recommendations.watched')"
          :disabled="busy"
          text
          @click="$emit('watched')"
        />
        <Button icon="pi pi-thumbs-up" :label="t('recommendations.like')" :disabled="busy" @click="$emit('like')" />
        <Button
          icon="pi pi-times"
          :label="t('recommendations.dislike')"
          :disabled="busy"
          severity="danger"
          outlined
          @click="$emit('dislike')"
        />
      </div>
    </div>
  </div>
 </template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useI18n } from 'vue-i18n';

interface Props {
  title: string;
  meta?: string;
  secondaryMeta?: string;
  tags?: string[];
  explanation?: string[];
  poster?: string | null;
  busy?: boolean;
  statusLabel?: string;
  canAddToWatchlist?: boolean;
  showWhatIf?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'details'): void;
  (e: 'add-to-watchlist'): void;
  (e: 'watched'): void;
  (e: 'like'): void;
  (e: 'dislike'): void;
  (e: 'tweak', payload: { runtime: 'shorter' | 'longer' | null; tone: 'lighter' | 'heavier' | null }): void;
}>();
const { t } = useI18n();

const posterStyle = computed(() =>
  props.poster
    ? { backgroundImage: `url(${props.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined,
);

const runtimeTweak = ref<'shorter' | 'longer' | null>(null);
const toneTweak = ref<'lighter' | 'heavier' | null>(null);

const toggleRuntime = (value: 'shorter' | 'longer') => {
  runtimeTweak.value = runtimeTweak.value === value ? null : value;
  emit('tweak', { runtime: runtimeTweak.value, tone: toneTweak.value });
};

const toggleTone = (value: 'lighter' | 'heavier') => {
  toneTweak.value = toneTweak.value === value ? null : value;
  emit('tweak', { runtime: runtimeTweak.value, tone: toneTweak.value });
};
</script>

<style scoped>
.rec-card {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 16px;
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  transition: transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.2s ease-out, background 0.25s ease-out;
  animation: rec-fade-in 0.35s ease-out;
}

.rec-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.45);
}

.poster {
  width: 100%;
  height: 220px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(138, 180, 255, 0.35), rgba(255, 73, 167, 0.25));
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  position: relative;
}

.badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.title {
  font-weight: 700;
  font-size: 20px;
}

.meta {
  color: var(--text-secondary);
}

.meta.subtle {
  opacity: 0.8;
  font-size: 13px;
}

.status-label {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(138, 180, 255, 0.16);
  border: 1px solid rgba(138, 180, 255, 0.45);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.why-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.why ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
}

.whatif {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.4);
  display: grid;
  gap: 4px;
}

.whatif-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.whatif-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.whatif-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.5);
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.spacer {
  flex: 1;
}

.placeholder {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
}

@keyframes rec-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .rec-card {
    grid-template-columns: 1fr;
  }
  .poster {
    height: 190px;
  }
}
</style>
