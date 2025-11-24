<template>
  <div class="title-card surface-card">
    <div class="meta-row">
      <div class="poster" :style="posterStyle">
        <span v-if="!title.poster" class="placeholder">Нет постера</span>
      </div>
      <div class="info">
        <div class="title">{{ title.name }}</div>
        <div class="meta">{{ [title.year, title.genres?.join(', ')].filter(Boolean).join(' · ') }}</div>
        <div class="actions">
          <Button
            :label="title.selected ? 'Убрать' : 'Смотрел'"
            :severity="title.selected ? 'secondary' : 'success'"
            size="small"
            @click="$emit('mark', title)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';

interface TitleCardProps {
  title: {
    id: string | number;
    name: string;
    year?: string;
    genres?: string[];
    poster?: string | null;
    selected?: boolean;
  };
}

const props = defineProps<TitleCardProps>();

const posterStyle = computed(() =>
  props.title.poster
    ? { backgroundImage: `url(${props.title.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined,
);
</script>

<style scoped>
.title-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
}

.poster {
  width: 100%;
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(138, 180, 255, 0.35), rgba(255, 73, 167, 0.25));
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.title {
  font-weight: 700;
  font-size: 16px;
}

.meta {
  color: var(--text-secondary);
  font-size: 14px;
}

.actions {
  margin-top: 8px;
}

.placeholder {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
}
</style>
