<template>
  <div class="rec-card surface-card">
    <div class="poster" :style="posterStyle">
      <span v-if="!poster" class="placeholder">Нет постера</span>
    </div>
    <div class="content">
      <div class="title">{{ title }}</div>
      <div class="meta" v-if="meta">{{ meta }}</div>
      <div class="chips" v-if="tags?.length">
        <Tag v-for="tag in tags" :key="tag" :value="tag" severity="info" />
      </div>
      <div class="why" v-if="explanation?.length">
        <div class="why-title">Почему в рекомендациях</div>
        <ul>
          <li v-for="reason in explanation" :key="reason">{{ reason }}</li>
        </ul>
      </div>
      <div class="actions">
        <Button icon="pi pi-thumbs-up" label="Нравится" :disabled="busy" @click="$emit('like')" />
        <Button icon="pi pi-times" label="Не подходит" :disabled="busy" severity="danger" outlined @click="$emit('dislike')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';

interface Props {
  title: string;
  meta?: string;
  tags?: string[];
  explanation?: string[];
  poster?: string | null;
  busy?: boolean;
}

const props = defineProps<Props>();

const posterStyle = computed(() =>
  props.poster
    ? { backgroundImage: `url(${props.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined,
);
</script>

<style scoped>
.rec-card {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
}

.poster {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(138, 180, 255, 0.35), rgba(255, 73, 167, 0.25));
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title {
  font-weight: 700;
  font-size: 18px;
}

.meta {
  color: var(--text-secondary);
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

.actions {
  display: flex;
  gap: 10px;
}

.placeholder {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
}

@media (max-width: 768px) {
  .rec-card {
    grid-template-columns: 1fr;
  }
  .poster {
    height: 180px;
  }
}
</style>
