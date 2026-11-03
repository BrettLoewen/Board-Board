<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useBoardStore } from "@/stores/board";
import { BOARD } from "@/constants";
import { worldToScreen } from "@/utils/camera";

const board = useBoardStore();

// The dots are drawn on a canvas that fills the viewport. It is not moved with the camera:
// the dots are drawn in screen space at positions worked out from the camera, so they never run out.
const canvasElement = useTemplateRef("canvas-element");

// The dot colour comes from a Nuxt UI variable so it follows light and dark mode
let dotColor = "";
function readDotColor(): void {
  dotColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--ui-border-accented")
    .trim();
}

// Smoothly ease from 0 to 1 as t goes from 0 to 1
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Draw the dot grid for the current camera.
//
// Each power of two of zoom is a "level". Within a level, t goes from 0 to 1:
// - The coarse dots spread from DOT_SPACING to twice that apart, and grow a little mid-level
// - Fine dots, halfway between the coarse ones, fade in and grow from nothing
// At t = 1 the fine and coarse dots are identical, and become the next level's coarse dots at t = 0,
// so no dot ever jumps in size or position when the level changes. Zooming out runs this in reverse.
function draw(): void {
  const canvas = canvasElement.value;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  // Size the canvas for the screen's pixel density so the dots stay crisp
  const { w, h } = board.viewport;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, w, h);

  const zoomLevel = Math.log2(board.camera.scale);
  const t = zoomLevel - Math.floor(zoomLevel);
  const coarseSpacing = BOARD.DOT_SPACING * 2 ** t;
  const fineSpacing = coarseSpacing / 2;
  const fineOpacity = smoothstep(t);
  const coarseRadius = BOARD.DOT_RADIUS * (1 + BOARD.DOT_GROWTH * Math.sin(Math.PI * t));
  const fineRadius = BOARD.DOT_RADIUS * t;

  // Dots are placed at the world origin plus whole steps of the fine spacing.
  // Even steps on both axes are coarse dots, and every other step is a fine dot.
  const origin = worldToScreen({ x: 0, y: 0 }, board.camera);
  const firstI = Math.floor(-origin.x / fineSpacing);
  const firstJ = Math.floor(-origin.y / fineSpacing);
  const lastI = Math.ceil((w - origin.x) / fineSpacing);
  const lastJ = Math.ceil((h - origin.y) / fineSpacing);

  // Collect each kind of dot into one path so each is filled in a single call
  const coarse = new Path2D();
  const fine = new Path2D();
  for (let i = firstI; i <= lastI; i++) {
    const x = origin.x + i * fineSpacing;
    for (let j = firstJ; j <= lastJ; j++) {
      const y = origin.y + j * fineSpacing;
      const isCoarse = i % 2 === 0 && j % 2 === 0;
      const radius = isCoarse ? coarseRadius : fineRadius;
      const path = isCoarse ? coarse : fine;
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, Math.PI * 2);
    }
  }

  context.fillStyle = dotColor;
  context.globalAlpha = 1;
  context.fill(coarse);
  if (fineOpacity > 0 && fineRadius > 0) {
    context.globalAlpha = fineOpacity;
    context.fill(fine);
  }
}

// Redraw at most once per frame, however many changes happen in that frame
let frame = 0;
function scheduleDraw(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
}

// Redraw whenever the camera or the viewport size changes
watch(() => [board.camera, board.viewport], scheduleDraw, { deep: true });

// Redraw when the colour mode changes (Nuxt UI switches the `dark` class on <html>)
const colorModeObserver = new MutationObserver(() => {
  readDotColor();
  scheduleDraw();
});

onMounted(() => {
  readDotColor();
  scheduleDraw();
  colorModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});

onUnmounted(() => {
  colorModeObserver.disconnect();
  cancelAnimationFrame(frame);
});
</script>

<template>
  <canvas class="board-dots" ref="canvas-element"></canvas>
</template>

<style>
.board-dots {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
