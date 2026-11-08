<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/stores/board";
import { parseDrawContent, strokeToSvg } from "@/cards/draw";
import { strokeColor } from "@/utils/colors";
import { DRAW } from "@/constants";

// BaseCard passes every body the same props and listeners. A drawing only needs the card,
// so the rest must not fall through onto the SVG as attributes.
defineOptions({ inheritAttrs: false });

// The drawing to show. The body never writes to the store or the database itself. BaseCard owns that.
const props = defineProps<{ card: Card }>();

const content = computed(() => parseDrawContent(props.card.content));

// Each line's SVG points inside the card. The points are fractions of the card's drawing area, so the line
// stretches when the card is resized, while its thickness (in world units) stays the same.
const lines = computed(() =>
  content.value.strokes.map((stroke) =>
    strokeToSvg(
      stroke,
      { width: props.card.width, height: props.card.height },
      content.value.thickness,
    ),
  ),
);
</script>

<template>
  <!-- The view box matches the card's size in world units, so nothing is stretched by the SVG itself -->
  <svg
    class="draw-card"
    :viewBox="`0 0 ${card.width} ${card.height}`"
    :style="{ stroke: strokeColor(content.color) }"
  >
    <template v-for="(points, index) in lines" :key="index">
      <!-- An invisible wider copy of the line, so it's easy to click even when it's thin -->
      <polyline
        class="draw-card-hit"
        :points="points"
        :stroke-width="content.thickness + 2 * DRAW.HIT_MARGIN"
      />
      <polyline class="draw-card-line" :points="points" :stroke-width="content.thickness" />
    </template>
  </svg>
</template>

<style>
.draw-card {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: filter 0.15s;
}
/* Picked up (held without moving) or being dragged */
.board-card-lifted .draw-card {
  filter: drop-shadow(0 6px 6px rgba(0, 0, 0, 0.3));
}

.draw-card-line {
  pointer-events: none;
}
/* Until the drawing is selected, only its line can be clicked (see board-card-hollow in BaseCard.vue) */
.draw-card-hit {
  stroke: transparent;
  pointer-events: stroke;
}
</style>
