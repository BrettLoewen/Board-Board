<script setup lang="ts">
import { computed } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import { useBoardStore } from "@/stores/board";
import { colorMenuItems } from "@/cards/colorMenu";
import { fontSizeMenuItems } from "@/cards/fontSizeMenu";
import { cardBackground, cardText } from "@/utils/colors";

const board = useBoardStore();

// The Note button is drawn in the colours the next note will have
const noteDefaults = computed(() => board.cardDefaults.note);
const noteButtonStyle = computed(() => ({
  backgroundColor: cardBackground(noteDefaults.value.color),
  color: cardText(noteDefaults.value.textColor, noteDefaults.value.color),
}));

// Right-clicking the Note button picks the colours and text size of the next note ahead of time.
// (Only the colours show on the button.)
const noteMenuItems = computed<ContextMenuItem[]>(() => [
  {
    label: "Next note colour",
    icon: "i-ph-palette",
    children: colorMenuItems({
      current: noteDefaults.value.color,
      swatch: cardBackground,
      onPick: (color) => board.setNoteDefaults({ color }),
      onCustom: () =>
        board.requestCustomColor({
          title: "Next note colour",
          color: noteDefaults.value.color,
          apply: (color) => board.setNoteDefaults({ color }),
        }),
    }),
  },
  {
    label: "Next note text colour",
    icon: "i-ph-text-aa",
    children: colorMenuItems({
      current: noteDefaults.value.textColor,
      swatch: (color) => cardText(color, noteDefaults.value.color),
      onPick: (textColor) => board.setNoteDefaults({ textColor }),
      onCustom: () =>
        board.requestCustomColor({
          title: "Next note text colour",
          color: noteDefaults.value.textColor,
          apply: (textColor) => board.setNoteDefaults({ textColor }),
        }),
    }),
  },
  {
    label: "Next note text size",
    icon: "i-ph-text-t",
    children: fontSizeMenuItems({
      current: noteDefaults.value.fontSize,
      onPick: (fontSize) => board.setNoteDefaults({ fontSize }),
    }),
  },
]);
</script>

<template>
  <div class="toolbar flex flex-col">
    <CardMenu :items="noteMenuItems">
      <UButton
        class="toolbar-button toolbar-note-button flex flex-col gap-0"
        :style="noteButtonStyle"
        title="Add a note (right-click to change its colour)"
        @click="board.createCard('note')"
      >
        <UIcon name="i-ph-note" class="size-14" />
        <p>Note</p>
      </UButton>
    </CardMenu>
    <UButton class="toolbar-button flex flex-col gap-0">
      <UIcon name="i-ix-shapes" class="size-14" />
      <p>Shape</p>
    </UButton>
    <UButton class="toolbar-button">Draw</UButton>
    <UButton class="toolbar-button">Erase</UButton>
  </div>
</template>

<style>
.toolbar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  /* Sit above the board viewport, which comes later in the page */
  z-index: 10;
  margin: 15px;
  padding: 15px;
  gap: 15px;
  background-color: var(--ui-bg);
  border-radius: 10px;
  border-width: 1px;
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.toolbar-button:active {
  background-color: var(--color-primary-800);
}
.toolbar-button:hover {
  cursor: pointer;
}
</style>
