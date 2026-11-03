<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useBoardStore } from "@/stores/board";
import { BOARD } from "@/constants";

const board = useBoardStore();

// The slider works on log(scale), so each step feels the same at every zoom
// (going from 10% to 20% moves it as far as going from 200% to 400%)
const sliderValue = computed({
  get: () => Math.log(board.camera.scale),
  set: (value: number | undefined) => {
    if (value !== undefined) board.zoomToScale(Math.exp(value));
  },
});

// The current zoom as a whole percentage
const zoomPercent = computed(() => `${Math.round(board.camera.scale * 100)}%`);

// Clicking the percentage turns it into a text field so an exact zoom can be typed
const editing = ref(false);
const typedZoom = ref("");
const inputElement = useTemplateRef("input-element");

async function startEditing(): Promise<void> {
  typedZoom.value = String(Math.round(board.camera.scale * 100));
  editing.value = true;

  // Focus the field and select its text so typing replaces the old value
  await nextTick();
  inputElement.value?.focus();
  inputElement.value?.select();
}

// Apply the typed zoom (Enter or clicking away). The store keeps it inside the allowed zoom range.
// Anything that isn't a positive number (with or without a "%") is ignored.
function commitEditing(): void {
  if (!editing.value) return;
  editing.value = false;

  const percent = parseFloat(typedZoom.value.replace("%", ""));
  if (Number.isFinite(percent) && percent > 0) board.zoomToScale(percent / 100);
}

// Leave the zoom as it was (Escape)
function cancelEditing(): void {
  editing.value = false;
}
</script>

<template>
  <div class="zoom-control board-overlay">
    <USlider
      v-model="sliderValue"
      class="zoom-slider"
      :min="Math.log(board.minScale)"
      :max="Math.log(BOARD.MAX_SCALE)"
      :step="0.01"
      size="sm"
    />
    <input
      v-if="editing"
      v-model="typedZoom"
      class="zoom-input text-sm"
      ref="input-element"
      aria-label="Zoom percentage"
      @keydown.enter="commitEditing"
      @keydown.escape="cancelEditing"
      @blur="commitEditing"
    />
    <button
      v-else
      class="zoom-percent text-sm"
      title="Type a zoom percentage"
      @click="startEditing"
    >
      {{ zoomPercent }}
    </button>
    <UButton
      class="zoom-fit-button"
      size="sm"
      variant="ghost"
      icon="i-ph-corners-out"
      aria-label="Fit board to screen"
      @click="board.fitToContent()"
    />
  </div>
</template>

<style>
.zoom-control {
  position: absolute;
  top: 0;
  right: 0;
  /* Sit above the board's cards */
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 15px;
  padding: 6px 6px 6px 15px;
  width: 260px;
  background-color: var(--ui-bg);
  border-radius: 10px;
  border-width: 1px;
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.zoom-percent,
.zoom-input {
  width: 3.5em;
  padding: 2px 4px;
  border-radius: 4px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.zoom-percent:hover {
  cursor: text;
  background-color: var(--ui-bg-elevated);
}
.zoom-input {
  outline: 1px solid var(--ui-primary);
  background-color: var(--ui-bg);
}
</style>
