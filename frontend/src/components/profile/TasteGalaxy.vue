<template>
  <div class="surface-card galaxy-card">
    <h3 class="section-title">Карта‑галактика вкуса</h3>
    <p class="subtitle">
      Узлы — жанры и тайтлы, которыми вы интересовались. Чем ближе к центру и крупнее точка, тем сильнее
      выражен интерес.
    </p>
    <div v-if="loading" class="galaxy-skeleton">
      <Skeleton height="260px" border-radius="18px" />
    </div>
    <div v-else-if="!layoutNodes.length" class="empty">
      Недостаточно данных — отметьте несколько просмотренных и понравившихся тайтлов.
    </div>
    <div v-else class="galaxy-root">
      <svg class="galaxy-lines" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <line
          v-for="edge in layoutEdges"
          :key="edge.id"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          :class="['edge', edge.kind]"
          :stroke-opacity="edge.opacity"
        />
      </svg>
      <div class="galaxy-nodes">
        <button
          v-for="node in layoutNodes"
          :key="node.id"
          type="button"
          class="node"
          :class="node.kind"
          :style="{ left: `${node.x}%`, top: `${node.y}%`, transform: `translate(-50%, -50%) scale(${node.scale})` }"
          @click="onNodeClick(node)"
        >
          <span class="node-label">
            {{ node.label }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Skeleton from 'primevue/skeleton';
import type { TasteGalaxyEdge, TasteGalaxyNode, TasteGalaxyResponse } from '../../api/analytics';

interface Props {
  data: TasteGalaxyResponse | null;
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'open-title', id: string): void;
}>();

interface LayoutNode {
  id: string;
  label: string;
  kind: TasteGalaxyNode['kind'];
  x: number;
  y: number;
  scale: number;
  raw: TasteGalaxyNode;
}

interface LayoutEdge {
  id: string;
  kind: TasteGalaxyEdge['kind'];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

const layoutNodes = computed<LayoutNode[]>(() => {
  if (!props.data) return [];
  const nodes = props.data.nodes;

  const centerX = 50;
  const centerY = 50;
  const genres = nodes.filter((n) => n.kind === 'genre');
  const user = nodes.find((n) => n.kind === 'user');

  const positions = new Map<string, { x: number; y: number; angle?: number }>();

  if (user) {
    positions.set(user.id, { x: centerX, y: centerY });
  }

  const genreCount = Math.max(1, genres.length);
  const genreRadius = 22;

  genres.forEach((g, index) => {
    const angle = (2 * Math.PI * index) / genreCount;
    const x = centerX + genreRadius * Math.cos(angle);
    const y = centerY + genreRadius * Math.sin(angle);
    positions.set(g.id, { x, y, angle });
  });

  const edgesByGenre = new Map<string, string[]>();
  props.data.edges
    .filter((e) => e.kind === 'belongs_to')
    .forEach((e) => {
      const list = edgesByGenre.get(e.source) ?? [];
      list.push(e.target);
      edgesByGenre.set(e.source, list);
    });

  const titleRadius = 36;
  edgesByGenre.forEach((titleIds, genreId) => {
    const base = positions.get(genreId);
    if (!base) return;
    const baseAngle = base.angle ?? 0;
    const count = titleIds.length;
    const spread = Math.min(Math.PI / 2, 0.35 * count);
    titleIds.forEach((titleId, index) => {
      const offset =
        count === 1 ? 0 : spread * (index / (count - 1) - 0.5);
      const angle = baseAngle + offset;
      const x = centerX + titleRadius * Math.cos(angle);
      const y = centerY + titleRadius * Math.sin(angle);
      positions.set(titleId, { x, y });
    });
  });

  const allNodes: LayoutNode[] = nodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: centerX, y: centerY };
    const baseWeight = Math.abs(n.weight ?? 1);
    const scale =
      n.kind === 'user'
        ? 1.2
        : n.kind === 'genre'
          ? 0.8 + Math.min(0.6, baseWeight / 10)
          : 0.6 + Math.min(0.5, baseWeight / 10);
    return {
      id: n.id,
      label: n.label,
      kind: n.kind,
      x: pos.x,
      y: pos.y,
      scale,
      raw: n,
    };
  });

  return allNodes;
});

const layoutEdges = computed<LayoutEdge[]>(() => {
  if (!props.data) return [];
  const positions = new Map(
    layoutNodes.value.map((n) => [n.id, { x: n.x, y: n.y }]),
  );

  return props.data.edges.map((e, idx) => {
    const from = positions.get(e.source);
    const to = positions.get(e.target);
    if (!from || !to) {
      return {
        id: `edge-${idx}`,
        kind: e.kind,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        opacity: 0,
      };
    }
    const baseOpacity =
      e.kind === 'preference' ? 0.6 : e.kind === 'belongs_to' ? 0.35 : 0.3;
    const opacity = Math.max(0.15, Math.min(1, baseOpacity * (e.strength + 0.5)));
    return {
      id: `${e.kind}-${idx}`,
      kind: e.kind,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      opacity,
    };
  });
});

const onNodeClick = (node: LayoutNode) => {
  if (node.kind === 'title') {
    const id = node.id.replace('title:', '');
    emit('open-title', id);
  }
};
</script>

<style scoped>
.galaxy-card {
  position: relative;
}

.subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.galaxy-skeleton {
  margin-top: 6px;
}

.galaxy-root {
  position: relative;
  height: 260px;
  margin-top: 6px;
  border-radius: 18px;
  background: radial-gradient(circle at 50% 40%, rgba(144, 202, 249, 0.25), transparent 60%),
    radial-gradient(circle at 10% 80%, rgba(244, 143, 177, 0.22), transparent 55%),
    radial-gradient(circle at 90% 85%, rgba(129, 199, 132, 0.18), transparent 50%),
    rgba(4, 7, 24, 0.9);
  overflow: hidden;
}

.galaxy-lines {
  position: absolute;
  inset: 0;
}

.edge {
  stroke-width: 0.3;
  stroke: rgba(255, 255, 255, 0.22);
}

.edge.preference {
  stroke-width: 0.5;
}

.edge.similar {
  stroke-dasharray: 1.2 1;
}

.galaxy-nodes {
  position: absolute;
  inset: 0;
}

.node {
  position: absolute;
  min-width: 40px;
  max-width: 120px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  background: rgba(19, 24, 56, 0.9);
  color: #e5ecff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0 0 0 1px rgba(144, 202, 249, 0.3);
  transition:
    box-shadow 0.2s ease-out,
    background 0.2s ease-out,
    transform 0.2s ease-out;
}

.node.user {
  background: linear-gradient(135deg, #8ab4ff, #ff49a7);
  color: #050816;
  font-weight: 600;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.9);
}

.node.genre {
  box-shadow: 0 0 0 1px rgba(248, 250, 252, 0.2);
}

.node.title {
  box-shadow: 0 0 0 1px rgba(129, 199, 132, 0.4);
}

.node:hover {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
  background: rgba(39, 51, 120, 0.95);
}

.node-label {
  white-space: normal;
}

.empty {
  margin-top: 8px;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .galaxy-root {
    height: 220px;
  }
}
</style>
