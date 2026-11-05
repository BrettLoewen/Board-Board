<script setup lang="ts">
import type { ContextMenuItem } from "@nuxt/ui";

// A right-click menu for cards and card buttons. Colour items (see colorMenu.ts) show a swatch of their colour,
// and text size menus (see fontSizeMenu.ts) start with a field for typing a size.
defineProps<{ items: ContextMenuItem[] | ContextMenuItem[][] }>();

// The slots' items aren't typed with the extra fields these menus add, so they are read here.
// A colour item's swatch colour (undefined for "Custom…" before a custom colour is picked)
function swatchOf(item: unknown): string | undefined {
  return (item as { swatch?: string }).swatch;
}
// A text size field's current size, and what to do with a typed size
function fontSizeOf(item: unknown): { fontSize: number; onPick: (fontSize: number) => void } {
  return item as { fontSize: number; onPick: (fontSize: number) => void };
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

    <template #font-size="{ item }">
      <FontSizeField
        :font-size="fontSizeOf(item).fontSize"
        @apply="fontSizeOf(item).onPick($event)"
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
