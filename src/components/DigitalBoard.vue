<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef } from "vue";
import { useBoardStore } from "@/stores/board";

const board = useBoardStore();

// The viewport element fills the area below the navbar. Its size is tracked in the store.
const viewportElement = useTemplateRef("viewport-element");
let resizeObserver: ResizeObserver | null = null;

// The world layer is moved and scaled to show the part of the board the camera is looking at.
// Cards inside it are positioned in world units.
const worldTransform = computed(() => {
  const { x, y, scale } = board.camera;
  return `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})`;
});

onMounted(() => {
  if (!viewportElement.value) return;

  // Keep the store's viewport size up to date (used to find the centre of the view, among other things)
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    board.viewport = { w: entry.contentRect.width, h: entry.contentRect.height };
  });
  resizeObserver.observe(viewportElement.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="board-viewport" ref="viewport-element">
    <div class="board-world" :style="{ transform: worldTransform }">
      <BaseCard v-for="card in board.cardList" :key="card.id" :card-id="card.id" />
    </div>
  </div>
</template>

<style>
.board-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.board-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
</style>
