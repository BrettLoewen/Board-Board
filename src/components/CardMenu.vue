<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";
import type { SizeFieldItem } from "@/cards/sizeMenu";

// A right-click menu for cards and card buttons. Colour items (see colorMenu.ts) show a swatch of their colour,
// and size menus (text size, line thickness, see sizeMenu.ts) start with a field for typing a size.
defineProps<{ items: ContextMenuItem[] | ContextMenuItem[][] }>();

// The slots' items aren't typed with the extra fields these menus add, so they are read here.
// A colour item's swatch colour (undefined for "Custom…" before a custom colour is picked)
function swatchOf(item: unknown): string | undefined {
  return (item as { swatch?: string }).swatch;
}
// A size field's current size, its range and labels, and what to do with a typed size
function sizeFieldOf(item: unknown): SizeFieldItem {
  return item as SizeFieldItem;
}
</script>

<template>
  <UContextMenu :items="items">
    <slot />

    <template #swatch-leading="{ item }">
      <span
        class="color-swatch"
        :class="{ 'color-swatch-custom': !swatchOf(item) }"
        :style="swatchOf(item) ? { background: swatchOf(item) } : undefined"
      ></span>
    </template>

    <template #size-field="{ item }">
      <SizeField
        :size="sizeFieldOf(item).size"
        :min="sizeFieldOf(item).range.min"
        :max="sizeFieldOf(item).range.max"
        :label="sizeFieldOf(item).label"
        :name="sizeFieldOf(item).name"
        @apply="sizeFieldOf(item).onPick($event)"
      />
    </template>
  </UContextMenu>
</template>

<style>
.color-swatch {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--ui-border-accented);
}
/* "Custom…" without a custom colour picked yet */
.color-swatch-custom {
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
}
</style>
