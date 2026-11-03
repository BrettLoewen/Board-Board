<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useBoardStore } from "@/stores/board";
import { BOARD } from "@/constants";

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

// The pointer that is panning the board, and where it was last seen
const panPointerId = ref<number | null>(null);
let lastPanPoint = { x: 0, y: 0 };

// Start panning on a middle-button drag anywhere, or a left-button drag on empty board.
// Cards don't stop the event from reaching here (interact.js needs it), so a left-button drag on a card
// is ignored here and moves the card instead.
function onPointerDown(event: PointerEvent): void {
  // Leave the overlay UI (like the zoom control) alone
  if ((event.target as Element).closest(".board-overlay")) return;

  const isMiddle = event.button === 1;
  const isLeftOnEmptyBoard =
    event.button === 0 && !(event.target as Element).closest(".board-card");

  // Clicking empty board deselects (and stops editing)
  if (isLeftOnEmptyBoard) board.select(null);

  if (!isMiddle && !isLeftOnEmptyBoard) return;

  // Keep receiving the pointer's events even if it leaves the viewport
  viewportElement.value?.setPointerCapture(event.pointerId);
  panPointerId.value = event.pointerId;
  lastPanPoint = { x: event.clientX, y: event.clientY };
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== panPointerId.value) return;

  board.panBy(event.clientX - lastPanPoint.x, event.clientY - lastPanPoint.y);
  lastPanPoint = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== panPointerId.value) return;
  panPointerId.value = null;
}

// Stop Windows' middle-click autoscroll from starting
function onMouseDown(event: MouseEvent): void {
  if (event.button === 1) event.preventDefault();
}

// The mouse wheel and trackpad two-finger scroll zoom around the cursor. Pinch (ctrlKey) zooms too.
function onWheel(event: WheelEvent): void {
  if (!viewportElement.value) return;

  // Convert the scroll distance to pixels (some devices report lines or pages)
  let delta = event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= board.viewport.h;

  const speed = event.ctrlKey ? BOARD.PINCH_ZOOM_SPEED : BOARD.WHEEL_ZOOM_SPEED;
  const rect = viewportElement.value.getBoundingClientRect();
  board.zoomAt(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    board.camera.scale * Math.exp(-delta * speed),
  );
}

// Delete or Backspace deletes the selected card, and Escape deselects it.
// Ignored while typing anywhere (a note being edited, the zoom field, a dialog).
function onKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable]")) return;
  if (!board.selectedCardId) return;

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    board.deleteCard(board.selectedCardId);
  } else if (event.key === "Escape") {
    board.select(null);
  }
}

// Fit the board to the screen once, when both the cards and the viewport's size are known
const stopInitialFit = watch(
  () => board.loaded && board.viewport.w > 0,
  (ready) => {
    if (!ready) return;
    board.fitToContent();
    stopInitialFit();
  },
);

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  if (!viewportElement.value) return;

  // Keep the store's viewport size up to date (used to find the centre of the view, among other things)
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    board.setViewport({ w: entry.contentRect.width, h: entry.contentRect.height });
  });
  resizeObserver.observe(viewportElement.value);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  resizeObserver?.disconnect();
  stopInitialFit();
});
</script>

<template>
  <div
    class="board-viewport"
    :class="{ panning: panPointerId !== null }"
    ref="viewport-element"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @mousedown="onMouseDown"
    @wheel.prevent="onWheel"
  >
    <BoardDots />
    <div class="board-world" :style="{ transform: worldTransform }">
      <BaseCard v-for="card in board.cardList" :key="card.id" :card-id="card.id" />
    </div>
    <ZoomControl />
    <CardColorModal />
  </div>
</template>

<style>
.board-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  cursor: grab;
}
.board-viewport.panning {
  cursor: grabbing;
}

.board-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
</style>
