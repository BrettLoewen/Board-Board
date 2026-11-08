<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useBoardStore } from "@/stores/board";
import { REALTIME } from "@/constants";
import { worldToScreen, type Point } from "@/utils/camera";
import { userColor } from "@/utils/users";

const board = useBoardStore();

// Where each cursor is drawn right now (world units). Cursor updates arrive about every 100 ms, so each cursor
// glides towards its latest position instead of jumping.
const shown = ref(new Map<string, Point>());
// The current time, refreshed every frame, so cursors that stop updating can be hidden
const now = ref(Date.now());
let frame = 0;
let lastFrame = 0;

// How quickly a cursor catches up with its latest position (the fraction of the gap closed per second is
// 1 - e^-SPEED, so it's nearly there within about a tenth of a second)
const SPEED = 25;

function step(time: number): void {
  const elapsed = lastFrame ? Math.min(0.1, (time - lastFrame) / 1000) : 0;
  lastFrame = time;
  now.value = Date.now();

  const follow = 1 - Math.exp(-SPEED * elapsed);
  const next = new Map<string, Point>();
  for (const cursor of board.remoteCursors.values()) {
    const from = shown.value.get(cursor.clientId);
    next.set(
      cursor.clientId,
      from
        ? { x: from.x + (cursor.x - from.x) * follow, y: from.y + (cursor.y - from.y) * follow }
        : { x: cursor.x, y: cursor.y },
    );
  }
  shown.value = next;

  // Keep animating only while there are cursors to show
  frame = board.remoteCursors.size ? requestAnimationFrame(step) : 0;
}

// Start animating when the first cursor arrives. (The store updates the map in place, so watch its size:
// watching the map itself would never see a change.)
watch(
  () => board.remoteCursors.size,
  () => {
    if (!frame && board.remoteCursors.size) {
      lastFrame = 0;
      frame = requestAnimationFrame(step);
    }
  },
);

// Each visible cursor's screen position, its user's name and colour.
// Hidden when it hasn't moved for a while, and when it's outside the view.
const cursors = computed(() => {
  const presenceByClient = new Map(board.presences.map((p) => [p.clientId, p]));
  const list = [];
  for (const cursor of board.remoteCursors.values()) {
    const presence = presenceByClient.get(cursor.clientId);
    const position = shown.value.get(cursor.clientId);
    if (!presence || !position || now.value - cursor.lastSeen > REALTIME.CURSOR_TIMEOUT) continue;

    const screen = worldToScreen(position, board.camera);
    if (screen.x < 0 || screen.y < 0 || screen.x > board.viewport.w || screen.y > board.viewport.h)
      continue;
    list.push({
      clientId: cursor.clientId,
      username: presence.username,
      color: userColor(presence.userId),
      screen,
    });
  }
  return list;
});

onMounted(() => {
  if (board.remoteCursors.size) frame = requestAnimationFrame(step);
});
onUnmounted(() => cancelAnimationFrame(frame));
</script>

<template>
  <!-- Drawn in screen space over the board, so cursors stay the same size at any zoom -->
  <div class="remote-cursors">
    <div
      v-for="cursor in cursors"
      :key="cursor.clientId"
      class="remote-cursor"
      :data-client-id="cursor.clientId"
      :style="{
        transform: `translate(${cursor.screen.x}px, ${cursor.screen.y}px)`,
        '--cursor-color': cursor.color,
      }"
    >
      <svg class="remote-cursor-arrow" width="18" height="20" viewBox="0 0 18 20">
        <path d="M1 1 L1 16 L5.5 12 L8.5 19 L11.5 17.7 L8.6 11 L15 11 Z" />
      </svg>
      <span class="remote-cursor-label">{{ cursor.username }}</span>
    </div>
  </div>
</template>

<style>
.remote-cursors {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /* Above the cards and lines being drawn, below the overlay UI */
  z-index: 5;
}

.remote-cursor {
  position: absolute;
  top: 0;
  left: 0;
}

.remote-cursor-arrow {
  display: block;
  fill: var(--cursor-color);
  stroke: #ffffff;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.remote-cursor-label {
  position: absolute;
  top: 18px;
  left: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--cursor-color);
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
