<template>
  <div class="grid">
    <div class="surface-card kpi">
      <h2 class="section-title">Профиль</h2>
      <div class="stats">
        <div>
          <div class="value">128</div>
          <div class="label">Просмотрено</div>
        </div>
        <div>
          <div class="value">246 ч</div>
          <div class="label">Суммарно</div>
        </div>
        <div>
          <div class="value">Триллеры</div>
          <div class="label">Любимый жанр</div>
        </div>
      </div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Карта вкуса</h3>
      <div class="chart-placeholder">Spider‑chart (в разработке)</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Жанры</h3>
      <div class="chart-placeholder">Bar chart</div>
    </div>

    <div class="surface-card">
      <h3 class="section-title">Антисписок</h3>
      <ul>
        <li v-for="title in antis" :key="title">{{ title }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const antis = ['Фильм, который не зашёл', 'Сериал мимо вкуса'];
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.kpi .stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.value { font-size: 24px; font-weight: 700; }
.label { color: var(--text-secondary); }

.chart-placeholder {
  background: var(--surface-2);
  border: 1px dashed var(--surface-border);
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  color: var(--text-secondary);
}
</style>
