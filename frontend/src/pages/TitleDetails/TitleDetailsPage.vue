<template>
  <div class="details surface-card">
    <div class="hero">
      <div class="poster" />
      <div class="info">
        <h2>Название тайтла</h2>
        <p class="meta">2023 · триллер · 120 мин</p>
        <p class="overview">Краткое описание фильма или сериала. Данные придут с бэкенда и TMDB.</p>
        <div class="actions">
          <Button label="В список" icon="pi pi-plus" />
          <Button label="Смотрел" icon="pi pi-check" severity="success" outlined />
          <Button icon="pi pi-thumbs-up" severity="success" text />
          <Button icon="pi pi-thumbs-down" severity="danger" text />
        </div>
      </div>
    </div>
    <div>
      <h3 class="section-title">Похожие тайтлы</h3>
      <div class="card-grid">
        <Skeleton v-for="n in 4" :key="n" height="200px" borderRadius="14px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
</script>

<style scoped>
.details { display: flex; flex-direction: column; gap: 18px; }
.hero { display: grid; grid-template-columns: 220px 1fr; gap: 16px; }
.poster { background: linear-gradient(135deg, rgba(138,180,255,0.35), rgba(255,73,167,0.25)); border-radius: 16px; height: 320px; }
.meta { color: var(--text-secondary); }
.overview { color: #cfd3e4; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 900px) { .hero { grid-template-columns: 1fr; } .poster { height: 220px; } }
</style>
