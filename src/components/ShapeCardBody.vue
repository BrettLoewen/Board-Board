<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/stores/board";
import { parseShapeContent } from "@/cards/shape";
import { cardBackground } from "@/utils/colors";

// BaseCard passes every body the same props and listeners. A shape only needs the card,
// so the rest must not fall through onto the SVG as attributes.
defineOptions({ inheritAttrs: false });

// The shape to draw. The body never writes to the store or the database itself. BaseCard owns that.
const props = defineProps<{ card: Card }>();

const content = computed(() => parseShapeContent(props.card.content));

// The shape's colour (resolved for the current colour mode)
const style = computed(() => ({ fill: cardBackground(content.value.color) }));
</script>

<template>
  <!-- The shape is drawn in a 100x100 box that stretches to fill the card, so resizing can squash it -->
  <svg
    class="shape-card"
    :data-shape="content.shape"
    :style="style"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    <rect v-if="content.shape === 'square'" width="100" height="100" />
    <polygon v-else-if="content.shape === 'triangle'" points="50,0 100,100 0,100" />
    <ellipse v-else cx="50" cy="50" rx="50" ry="50" />
  </svg>
</template>

<style>
.shape-card {
  display: block;
  width: 100%;
  height: 100%;
  /* The shadow follows the shape's outline, instead of the card's rectangle (see board-card-frameless) */
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
  transition: filter 0.15s;
}
/* Picked up (held without moving) or being dragged */
.board-card-lifted .shape-card {
  filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.3));
}
</style>
