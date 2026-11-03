<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useBoardStore } from "@/stores/board";
import { isHexColor, normalizeHex } from "@/utils/colors";

const board = useBoardStore();

// The modal is open while the store has a request for a custom colour
const open = computed({
  get: () => board.customColorRequest !== null,
  set: (value) => {
    if (!value) board.closeCustomColor();
  },
});

// The colour being picked, and the hex code typed for it. Each follows the other.
const color = ref("#ffffff");
const hexInput = ref("#ffffff");

// Start from the colour being replaced, if it's already a custom colour
watch(
  () => board.customColorRequest,
  (request) => {
    if (!request) return;
    color.value = isHexColor(request.color) ? request.color : "#ffffff";
    hexInput.value = color.value;
  },
);

// Keep the hex code in step with the picker
function onPickerChange(value: string | undefined): void {
  if (!value) return;
  color.value = value;
  hexInput.value = value;
}

// Update the picker as soon as a valid hex code is typed ("#abc" and "abc" work too)
const hexError = ref(false);
function onHexInput(value: string | number): void {
  hexInput.value = String(value);
  const hex = normalizeHex(hexInput.value);
  hexError.value = hex === null;
  if (hex) color.value = hex;
}

// Use the colour and close
function apply(): void {
  const hex = normalizeHex(color.value);
  if (!hex || !board.customColorRequest) return;

  board.customColorRequest.apply(hex);
  board.closeCustomColor();
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="board.customColorRequest?.title ?? 'Custom colour'"
    description="Pick a colour, or type its hex code."
  >
    <template #body>
      <div class="flex flex-col items-center gap-4">
        <UColorPicker :model-value="color" @update:model-value="onPickerChange" />
        <div class="flex w-full items-center gap-3">
          <span class="color-preview" :style="{ background: color }"></span>
          <UInput
            class="custom-color-hex-input flex-1"
            :model-value="hexInput"
            :color="hexError ? 'error' : 'primary'"
            placeholder="#rrggbb"
            @update:model-value="onHexInput"
            @keydown.enter="apply"
          />
        </div>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="open = false" />
          <UButton class="custom-color-apply-button" label="Apply" @click="apply" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style>
.color-preview {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--ui-border-accented);
}
</style>
