<script setup lang="ts">
import { ref, watch } from "vue";

// A field at the top of a size menu (text size, line thickness) for typing any size, like the zoom percentage.
// `label` is shown beside the field, and `name` is what screen readers call it.
const props = defineProps<{
  size: number;
  min: number;
  max: number;
  label: string;
  name: string;
}>();
const emit = defineEmits<{ apply: [size: number] }>();

const typed = ref(String(props.size));
watch(
  () => props.size,
  (size) => (typed.value = String(size)),
);

// Apply the typed size (Enter or clicking away), kept inside the allowed range.
// Anything that isn't a number is ignored and the field goes back to the current size.
function apply(): void {
  const size = Math.round(parseFloat(typed.value));
  if (Number.isFinite(size) && size !== props.size) {
    emit("apply", Math.min(props.max, Math.max(props.min, size)));
  } else {
    typed.value = String(props.size);
  }
}

// The menu listens for keys (to jump between items by typing their names, and to move with the arrow keys),
// so keys typed here are kept from reaching it. Escape still closes the menu.
function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") return;
  event.stopPropagation();
  if (event.key === "Enter") apply();
}
</script>

<template>
  <label class="size-field">
    <span>{{ label }}</span>
    <input
      v-model="typed"
      class="size-input"
      inputmode="numeric"
      :aria-label="name"
      @keydown="onKeyDown"
      @blur="apply"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </label>
</template>

<style>
.size-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-weight: normal;
  color: var(--ui-text);
}

.size-input {
  width: 4em;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--ui-border-accented);
  background-color: var(--ui-bg);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.size-input:focus {
  outline: 1px solid var(--ui-primary);
}
</style>
