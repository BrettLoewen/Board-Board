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

// While the card is dragged, the pointer's last position (in client pixels) and the animation frame that
// pans the board when the pointer is near the viewport's edge
let dragPointer = { x: 0, y: 0 };
let edgePanFrame = 0;
let lastEdgePanTime = 0;

// How strongly to pan towards an edge: 0 outside the edge zone, rising to 1 at the edge (and beyond it)
function edgeStrength(distanceToEdge: number): number {
  return Math.min(1, Math.max(0, (BOARD.EDGE_PAN_ZONE - distanceToEdge) / BOARD.EDGE_PAN_ZONE));
}

// Pan the board each frame while the dragged card's pointer is near the viewport's edge.
// The card is carried along so it stays under the pointer, and the board grows to make room.
function edgePanStep(time: number): void {
  // Time since the last frame in seconds, so the speed doesn't depend on the frame rate
  const elapsed = lastEdgePanTime ? (time - lastEdgePanTime) / 1000 : 0;
  lastEdgePanTime = time;

  const viewportRect = cardElement.value?.closest(".board-viewport")?.getBoundingClientRect();
  if (viewportRect && elapsed) {
    // Positive means "pan to see more to the right/bottom"
    const x =
      edgeStrength(viewportRect.right - dragPointer.x) -
      edgeStrength(dragPointer.x - viewportRect.left);
    const y =
      edgeStrength(viewportRect.bottom - dragPointer.y) -
      edgeStrength(dragPointer.y - viewportRect.top);

    // panBy moves the board's content, so it moves the opposite way to the view
    const distance = BOARD.EDGE_PAN_SPEED * elapsed;
    if ((x || y) && board.edgePan(props.cardId, -x * distance, -y * distance)) {
      throttledPersist();
    }
  }

  edgePanFrame = requestAnimationFrame(edgePanStep);
}

function stopEdgePan(): void {
  cancelAnimationFrame(edgePanFrame);
  edgePanFrame = 0;
  lastEdgePanTime = 0;
}

// Setup interact.js to drag and resize the card.
// interact.js reports pointer movement in screen pixels, so every value is divided by the camera's scale
// to convert it to world units.
onMounted(() => {
  // Ensure the card element is not null before making it interactable
  if (!cardElement.value) return;

  interactable = interact(cardElement.value)
    .draggable({
      // Only the left mouse button moves cards (the middle button pans the board, even over a card)
      mouseButtons: 1,
      inertia: false,
      listeners: {
        // Zooming is blocked while a card is being dragged or resized
        start(event) {
          board.setCardInteraction(true);
          dragPointer = { x: event.clientX, y: event.clientY };
          edgePanFrame = requestAnimationFrame(edgePanStep);
        },
        move(event) {
          if (!card.value) return;

          dragPointer = { x: event.clientX, y: event.clientY };
          board.updateGeometry(props.cardId, {
            x: card.value.x + event.dx / scale(),
            y: card.value.y + event.dy / scale(),
          });
          throttledPersist();
        },
        end() {
          stopEdgePan();
          board.setCardInteraction(false);
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
        // Zooming is blocked while a card is being dragged or resized
        start() {
          board.setCardInteraction(true);
        },
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
          board.setCardInteraction(false);
          board.persistCard(props.cardId);
        },
      },
    });
});

// Clean up the interaction listeners
onUnmounted(() => {
  stopEdgePan();
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
  /* The board shows a grab cursor for panning, which doesn't apply to cards */
  cursor: default;
}
.board-card:active {
  cursor: move;
}
</style>
