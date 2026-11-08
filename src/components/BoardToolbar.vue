<script setup lang="ts">
import { computed } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import { useBoardStore } from "@/stores/board";
import { colorMenuItems } from "@/cards/colorMenu";
import { fontSizeMenuItems } from "@/cards/fontSizeMenu";
import { SHAPE_KINDS, shapeKindMenuItems } from "@/cards/shape";
import { drawOptionMenuItems } from "@/cards/draw";
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

// The Shape button is drawn in the colour of the next shape, with that shape as its icon
const shapeDefaults = computed(() => board.cardDefaults.shape);
const shapeButtonStyle = computed(() => ({
  backgroundColor: cardBackground(shapeDefaults.value.color),
  color: cardText("auto", shapeDefaults.value.color),
}));
const shapeButtonIcon = computed(
  () => SHAPE_KINDS.find((kind) => kind.value === shapeDefaults.value.shape)?.icon ?? "i-ix-shapes",
);

// Right-clicking the Shape button picks the next shape and its colour ahead of time
const shapeMenuItems = computed<ContextMenuItem[]>(() => [
  {
    label: "Next shape",
    icon: "i-ix-shapes",
    children: shapeKindMenuItems({
      current: shapeDefaults.value.shape,
      onPick: (shape) => board.setShapeDefaults({ shape }),
    }),
  },
  {
    label: "Next shape colour",
    icon: "i-ph-palette",
    children: colorMenuItems({
      current: shapeDefaults.value.color,
      swatch: cardBackground,
      onPick: (color) => board.setShapeDefaults({ color }),
      onCustom: () =>
        board.requestCustomColor({
          title: "Next shape colour",
          color: shapeDefaults.value.color,
          apply: (color) => board.setShapeDefaults({ color }),
        }),
    }),
  },
]);

// The Draw button turns the Draw tool on and off, and is drawn in the next line's colour
const drawing = computed(() => board.tool === "draw");
const drawDefaults = computed(() => board.cardDefaults.draw);
const drawButtonStyle = computed(() => ({
  backgroundColor: cardBackground(drawDefaults.value.color),
  color: cardText("auto", drawDefaults.value.color),
}));

// Right-clicking the Draw button picks the next line's colour and thickness ahead of time
const drawMenuItems = computed<ContextMenuItem[]>(() =>
  drawOptionMenuItems({
    labels: {
      color: "Next line colour",
      thickness: "Next line thickness",
      customTitle: "Next line colour",
    },
    current: drawDefaults.value,
    board,
    onPick: (patch) => board.setDrawDefaults(patch),
  }),
);

// Adding a note or shape goes back to the Select tool, so the new card can be used straight away
function createCard(type: "note" | "shape"): void {
  board.setTool("select");
  board.createCard(type);
}
</script>

<template>
  <div class="toolbar flex flex-col">
    <CardMenu :items="noteMenuItems">
      <UButton
        class="toolbar-button toolbar-note-button flex flex-col gap-0"
        :style="noteButtonStyle"
        title="Add a note (right-click to change its colour)"
        @click="createCard('note')"
      >
        <UIcon name="i-ph-note" class="size-14" />
        <p>Note</p>
      </UButton>
    </CardMenu>
    <CardMenu :items="shapeMenuItems">
      <UButton
        class="toolbar-button toolbar-shape-button flex flex-col gap-0"
        :style="shapeButtonStyle"
        title="Add a shape (right-click to change which shape and its colour)"
        @click="createCard('shape')"
      >
        <UIcon :name="shapeButtonIcon" class="size-14" />
        <p>Shape</p>
      </UButton>
    </CardMenu>
    <CardMenu :items="drawMenuItems">
      <UButton
        class="toolbar-button toolbar-draw-button flex flex-col gap-0"
        :class="{ 'toolbar-button-active': drawing }"
        :style="drawButtonStyle"
        :aria-pressed="drawing"
        title="Draw lines on the board (right-click to change the line's colour and thickness, Escape to stop)"
        @click="board.setTool(drawing ? 'select' : 'draw')"
      >
        <UIcon name="i-ph-pencil-simple" class="size-14" />
        <p>Draw</p>
      </UButton>
    </CardMenu>
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
/* The tool that is turned on (such as Draw) */
.toolbar-button-active {
  outline: 3px solid var(--ui-primary);
  outline-offset: 2px;
}
</style>
