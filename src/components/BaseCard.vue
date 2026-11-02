<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef } from "vue";
import interact from "interactjs";
import { useBoardStore } from "@/stores/board";
import { BOARD } from "@/constants";
import { throttle } from "@/utils/throttle";

// The id of the card this frame displays. The card's data is always read from the board store.
const props = defineProps<{ cardId: string }>();

const board = useBoardStore();
const card = computed(() => board.cards.get(props.cardId));

// Get a reference to the card element for the interaction mapping
const cardElement = useTemplateRef("card-element");
let interactable: ReturnType<typeof interact> | null = null;

// Write the card's geometry to the database while it is being dragged or resized.
// A final write is made when the interaction ends, so the last position is never lost.
const throttledPersist = throttle(
  () => board.persistCard(props.cardId),
  BOARD.GEOMETRY_WRITE_INTERVAL,
);

// The current zoom. Read at event time so zooming mid-interaction is handled correctly.
function scale(): number {
  return board.camera.scale;
}

// Setup interact.js to drag and resize the card.
// interact.js reports pointer movement in screen pixels, so every value is divided by the camera's scale
// to convert it to world units.
onMounted(() => {
  // Ensure the card element is not null before making it interactable
  if (!cardElement.value) return;

  interactable = interact(cardElement.value)
    .draggable({
      // Only the left mouse button moves cards (the middle button will pan the board)
      mouseButtons: 1,
      inertia: false,
      listeners: {
        move(event) {
          if (!card.value) return;

          board.updateGeometry(props.cardId, {
            x: card.value.x + event.dx / scale(),
            y: card.value.y + event.dy / scale(),
          });
          throttledPersist();
        },
        end() {
          board.persistCard(props.cardId);
        },
      },
    })
    .resizable({
      mouseButtons: 1,
      edges: { top: true, left: true, bottom: true, right: true },
      // Stop the card from shrinking below its minimum size.
      // The minimum is a function so it is converted to screen pixels using the current scale.
      modifiers: [
        interact.modifiers.restrictSize({
          min: () => ({
            top: 0,
            left: 0,
            right: BOARD.CARD_MIN_SIZE.width * scale(),
            bottom: BOARD.CARD_MIN_SIZE.height * scale(),
          }),
        }),
      ],
      listeners: {
        move(event) {
          if (!card.value) return;

          // event.rect is the card's new on-screen rect, so dividing it by the scale gives its world size
          board.updateGeometry(props.cardId, {
            width: event.rect.width / scale(),
            height: event.rect.height / scale(),
            x: card.value.x + event.deltaRect.left / scale(),
            y: card.value.y + event.deltaRect.top / scale(),
          });
          throttledPersist();
        },
        end() {
          board.persistCard(props.cardId);
        },
      },
    });
});

// Clean up the interaction listeners
onUnmounted(() => {
  interactable?.unset();
});
</script>

<template>
  <div
    v-if="card"
    class="board-card"
    :data-card-id="card.id"
    :style="{
      transform: `translate(${card.x}px, ${card.y}px)`,
      width: card.width + 'px',
      height: card.height + 'px',
    }"
    ref="card-element"
  ></div>
</template>

<style>
.board-card {
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--ui-bg-elevated);
  border: 3px solid var(--ui-border-accented);
  border-radius: 4px;
  user-select: none;
  touch-action: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.board-card:active {
  cursor: move;
}
</style>
