<template>
  <div class="surface-card">
    <div class="header">
      <h2 class="section-title">История просмотра</h2>
      <Dropdown v-model="period" :options="periods" optionLabel="label" optionValue="value" />
    </div>
    <div class="list">
      <div v-for="item in history" :key="item.id" class="surface-card row">
        <div>
          <div class="title">{{ item.title }}</div>
          <div class="meta">{{ item.date }} · {{ item.meta }}</div>
        </div>
        <div class="actions">
          <Rating v-model="item.rating" :cancel="false" />
          <div class="buttons">
            <Button icon="pi pi-thumbs-up" text severity="success" />
            <Button icon="pi pi-thumbs-down" text severity="danger" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import Dropdown from 'primevue/dropdown';
import Rating from 'primevue/rating';
import Button from 'primevue/button';

const periods = [
  { label: '30 дней', value: '30' },
  { label: '90 дней', value: '90' },
  { label: 'Год', value: '365' },
];

const period = ref('90');
const history = reactive(
  Array.from({ length: 5 }, (_, i) => ({
    id: i,
    title: `Просмотренный тайтл ${i + 1}`,
    meta: 'драма · 2022',
    rating: 8,
    date: '2024-11-01',
  })),
);
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title { font-weight: 700; }
.meta { color: var(--text-secondary); }
.actions { display: flex; align-items: center; gap: 12px; }
.buttons { display: flex; gap: 6px; }
</style>
