<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useBoardStore } from "@/stores/board";
import { BOARD } from "@/constants";
import { screenToWorld, type Point } from "@/utils/camera";

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

// The pointer that is drawing a line (with the Draw tool)
let drawPointerId: number | null = null;

// Convert a pointer's position to world units
function eventToWorld(event: PointerEvent): Point {
  const rect = viewportElement.value!.getBoundingClientRect();
  return screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, board.camera);
}

// With the Draw tool, a left-button drag anywhere on the board draws a line (cards ignore the pointer then,
// so lines can start over them). Otherwise, a middle-button drag anywhere or a left-button drag on empty board
// pans. Cards don't stop the event from reaching here (interact.js needs it), so a left-button drag on a card
// is ignored here and moves the card instead.
function onPointerDown(event: PointerEvent): void {
  // Leave the overlay UI (like the zoom control) alone
  if ((event.target as Element).closest(".board-overlay")) return;

  if (board.tool === "draw" && event.button === 0) {
    // Keep receiving the pointer's events even if it leaves the viewport
    viewportElement.value?.setPointerCapture(event.pointerId);
    drawPointerId = event.pointerId;
    board.startStroke(eventToWorld(event));
    return;
  }

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
  // Show everyone else where this pointer is (C4). Only the mouse, or a pen or finger touching the board,
  // has a position worth sharing.
  if (event.pointerType === "mouse" || event.buttons) board.moveCursor(eventToWorld(event));

  if (event.pointerId === drawPointerId) {
    // The browser can merge several pointer moves into one event. Using all of them keeps fast lines smooth.
    const events = event.getCoalescedEvents?.() ?? [];
    board.extendStroke((events.length ? events : [event]).map(eventToWorld));
    return;
  }
  if (event.pointerId !== panPointerId.value) return;

  board.panBy(event.clientX - lastPanPoint.x, event.clientY - lastPanPoint.y);
  lastPanPoint = { x: event.clientX, y: event.clientY };
}

// Letting go finishes the line (it becomes a card) or the pan
function onPointerUp(event: PointerEvent): void {
  if (event.pointerId === drawPointerId) {
    drawPointerId = null;
    board.endStroke();
    return;
  }
  if (event.pointerId !== panPointerId.value) return;
  panPointerId.value = null;
}

// The browser took the pointer away (for example, a touch turned into a gesture), so drop the line or the pan
function onPointerCancel(event: PointerEvent): void {
  if (event.pointerId === drawPointerId) {
    drawPointerId = null;
    board.cancelStroke();
    return;
  }
  onPointerUp(event);
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

// Delete or Backspace deletes the selected card. Escape drops the line being drawn, or else leaves the
// Draw tool, or else deselects. Ignored while typing anywhere (a note being edited, the zoom field, a dialog).
function onKeyDown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, [contenteditable]")) return;

  if (event.key === "Escape") {
    if (board.activeStroke) {
      // The pointer is still down, so its release mustn't finish a line
      drawPointerId = null;
      board.cancelStroke();
    } else if (board.tool === "draw") board.setTool("select");
    else board.select(null);
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && board.selectedCardId) {
    event.preventDefault();
    board.deleteCard(board.selectedCardId);
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
    :class="{ panning: panPointerId !== null, 'board-tool-draw': board.tool === 'draw' }"
    ref="viewport-element"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="board.moveCursor(null)"
    @mousedown="onMouseDown"
    @wheel.prevent="onWheel"
  >
    <BoardDots />
    <div class="board-world" :style="{ transform: worldTransform }">
      <BaseCard v-for="card in board.cardList" :key="card.id" :card-id="card.id" />
      <DrawPreview />
    </div>
    <RemoteCursors />
    <ZoomControl />
    <!-- The connection dropped after the board opened. Changes are caught up on when it comes back. -->
    <div v-if="board.reconnecting" class="board-reconnecting board-overlay">
      <UIcon name="i-ph-wifi-slash" class="size-4" />
      Reconnecting…
    </div>
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
/* With the Draw tool, the board is for drawing: cards ignore the pointer, so lines can start over them.
   (!important because the right-click menu's trigger puts an inline `pointer-events: auto` on each card.) */
.board-viewport.board-tool-draw {
  cursor: crosshair;
}
.board-tool-draw .board-card,
.board-tool-draw .board-card * {
  pointer-events: none !important;
}

.board-reconnecting {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--ui-border-accented);
  background-color: var(--ui-bg);
  color: var(--ui-text);
  font-size: 14px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.board-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
</style>
