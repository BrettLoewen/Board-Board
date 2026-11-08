<script setup lang="ts">
import { computed } from "vue";
import { useBoardStore } from "@/stores/board";
import { pointsToSvg } from "@/cards/draw";
import { strokeColor } from "@/utils/colors";

const board = useBoardStore();

// The lines being drawn right now: other people's (ghost lines), then this client's on top.
// Each one becomes a draw card when it is finished.
const strokes = computed(() => {
  const ghosts = [...board.ghostStrokes.values()];
  return board.activeStroke ? [...ghosts, board.activeStroke] : ghosts;
});
</script>

<template>
  <!-- Drawn in the world layer, so the points are in world units and the camera moves and scales them.
       The SVG has no size of its own and shows everything outside it. -->
  <svg class="draw-preview" width="1" height="1">
    <polyline
      v-for="stroke in strokes"
      :key="stroke.id"
      class="draw-preview-stroke"
      :data-stroke-id="stroke.id"
      :points="
        pointsToSvg(
          stroke.points.length === 1 ? [stroke.points[0]!, stroke.points[0]!] : stroke.points,
        )
      "
      :stroke="strokeColor(stroke.color)"
      :stroke-width="stroke.thickness"
    />
  </svg>
</template>

<style>
.draw-preview {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  /* Above every card (cards use z-indexes from 1 up to the number of cards) */
  z-index: 1000000;
  pointer-events: none;
}

.draw-preview-stroke {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
