<template>
  <div class="surface-card">
    <div class="header">
      <h2 class="section-title">{{ t('watchlist.title') }}</h2>
      <Dropdown v-model="status" :options="statuses" optionLabel="label" optionValue="value" showClear />
    </div>
    <div v-if="loading" class="card-grid">
      <Skeleton v-for="i in 4" :key="i" height="140px" borderRadius="14px" />
    </div>
    <div v-else class="card-grid">
      <div v-if="items.length === 0" class="empty">{{ t('watchlist.empty') }}</div>
      <div v-else v-for="item in items" :key="item.id" class="surface-card watch-item">
        <div class="watch-row">
          <div>
            <RouterLink class="title" :to="`/title/${item.title.id}`">{{ item.title.russianTitle || item.title.originalTitle }}</RouterLink>
            <div class="meta">{{ buildMeta(item) }}</div>
          </div>
          <Button label="Подробнее" icon="pi pi-angle-right" text @click="openDetails(item.title.id)" />
        </div>
        <Dropdown
          v-model="item.status"
          :options="statuses"
          optionLabel="label"
          optionValue="value"
          @change="(e: DropdownChangeEvent) => changeStatus(item, e.value as TitleStatus)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Dropdown, { type DropdownChangeEvent } from 'primevue/dropdown';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import { useI18n } from 'vue-i18n';
import type { TitleStatus, UserTitleStateResponse } from '../../api/types';
import { listUserTitles, updateUserTitle } from '../../api/userTitles';
import { useRouter } from 'vue-router';

const toast = useToast();
const router = useRouter();
const { t } = useI18n();
const statuses = computed(() => [
  { label: t('watchlist.status.planned'), value: 'planned' },
  { label: t('watchlist.status.watching'), value: 'watching' },
  { label: t('watchlist.status.watched'), value: 'watched' },
  { label: t('watchlist.status.dropped'), value: 'dropped' },
]);
const status = ref<TitleStatus | null>('planned');
const items = ref<UserTitleStateResponse[]>([]);
const loading = ref(false);

const load = async () => {
  loading.value = true;
  try {
    items.value = await listUserTitles({ status: status.value ?? undefined });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось загрузить список', detail: 'Попробуйте ещё раз', life: 4000 });
  } finally {
    loading.value = false;
  }
};

const changeStatus = async (item: UserTitleStateResponse, newStatus: TitleStatus) => {
  try {
    const updated = await updateUserTitle(item.id, { status: newStatus });
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx >= 0) items.value[idx] = updated;
    toast.add({ severity: 'success', summary: 'Обновлено', detail: 'Статус изменён', life: 2000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Не удалось изменить статус', detail: 'Попробуйте ещё раз', life: 4000 });
  }
};

const buildMeta = (item: UserTitleStateResponse) => {
  const year = item.title.releaseDate ? new Date(item.title.releaseDate).getFullYear() : null;
  return [year, item.title.genres?.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
};

const openDetails = (id: string) => router.push(`/title/${id}`);

watch(status, () => load());
onMounted(load);
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.watch-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  font-weight: 700;
}

.meta {
  color: var(--text-secondary);
}

.empty {
  color: var(--text-secondary);
  padding: 12px 0;
}
</style>
