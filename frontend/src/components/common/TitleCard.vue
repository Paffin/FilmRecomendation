<template>
  <div class="title-card surface-card">
    <div class="meta-row">
      <div class="poster" :style="posterStyle" @click="$emit('details', title)">
        <span v-if="!title.poster" class="placeholder">Нет постера</span>
      </div>
      <div class="info">
        <div class="title" @click="$emit('details', title)">{{ title.name }}</div>
        <div class="meta">{{ [title.year, title.genres?.join(', ')].filter(Boolean).join(' · ') }}</div>
        <div class="actions">
          <template v-if="mode === 'like'">
            <Button
              icon="pi pi-thumbs-up"
              :label="title.selected ? 'Убрать' : 'Нравится'"
              :severity="title.selected ? 'secondary' : 'success'"
              size="small"
              @click.stop="$emit('mark', title)"
            />
            <Button
              icon="pi pi-thumbs-down"
              :label="title.disliked ? 'Отменить дизлайк' : 'Не нравится'"
              :outlined="!title.disliked"
              severity="danger"
              size="small"
              @click.stop="$emit('dislike', title)"
            />
            <Button
              icon="pi pi-eye"
              label="Подробнее"
              text
              size="small"
              @click.stop="$emit('details', title)"
            />
          </template>
          <template v-else>
            <Button
              icon="pi pi-check"
              :label="title.selected ? 'Смотрел' : 'Смотрел'"
              :severity="title.selected ? 'success' : 'secondary'"
              size="small"
              @click.stop="$emit('mark', title)"
            />
            <Button
              icon="pi pi-times"
              label="Не смотрел"
              outlined
              severity="secondary"
              size="small"
              @click.stop="$emit('dislike', title)"
            />
            <Button
              icon="pi pi-eye"
              label="Подробнее"
              text
              size="small"
              @click.stop="$emit('details', title)"
            />
          </template>
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
    disliked?: boolean;
  };
  mode?: 'like' | 'watched';
}

const props = withDefaults(defineProps<TitleCardProps>(), {
  mode: 'like',
});

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
  transition: transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.18s ease-out;
}

.title-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
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
  overflow: hidden;
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
