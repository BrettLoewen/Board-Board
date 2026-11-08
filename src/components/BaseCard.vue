<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import interact from "interactjs";
import type { ContextMenuItem } from "@nuxt/ui";
import { useBoardStore } from "@/stores/board";
import { BOARD, REALTIME } from "@/constants";
import { CARD_TYPES } from "@/cards/registry";
import { LAYERS } from "@/types/cards";
import type { HoldMode } from "@/realtime/locks";
import type { Point } from "@/utils/camera";
import { throttle } from "@/utils/throttle";
import { debounce } from "@/utils/debounce";

// The pointer must move this far after pressing a card before a drag or resize starts.
// Until then, the press may still turn out to be a click.
interact.pointerMoveTolerance(BOARD.DRAG_THRESHOLD);

// The id of the card this frame displays. The card's data is always read from the board store.
const props = defineProps<{ cardId: string }>();

const board = useBoardStore();
const card = computed(() => board.cards.get(props.cardId));

// What this type of card looks like and how it behaves (see the card type registry)
const definition = computed(() => (card.value ? CARD_TYPES[card.value.type] : undefined));

const isSelected = computed(() => board.selectedCardId === props.cardId);
const isEditing = computed(() => board.editingCardId === props.cardId);

// Get a reference to the card element for the interaction mapping
const cardElement = useTemplateRef("card-element");
let interactable: ReturnType<typeof interact> | null = null;

// Write the card's geometry to the database while it is being dragged or resized.
// A final write is made when the interaction ends, so the last position is never lost.
const throttledPersist = throttle(
  () => board.persistCard(props.cardId),
  BOARD.GEOMETRY_WRITE_INTERVAL,
);

// Write the card's content a short while after the user stops typing.
// It is also written straight away when editing stops (if it changed).
const debouncedPersistContent = debounce(
  () => board.persistCard(props.cardId),
  BOARD.CONTENT_WRITE_DELAY,
);

// Share the card's changes with everyone else on the board while it is moved, resized or typed in.
// A final broadcast is sent when the card is released.
const throttledBroadcastGeometry = throttle(
  () => board.broadcastGeometry(props.cardId),
  REALTIME.RATES.GEOMETRY,
);
const throttledBroadcastContent = throttle(
  () => board.broadcastContent(props.cardId),
  REALTIME.RATES.CONTENT,
);

// The current zoom. Read at event time so zooming mid-interaction is handled correctly.
function scale(): number {
  return board.camera.scale;
}

//============ Click, hold or drag ============
// Pressing a card and letting go quickly (without moving) is a click, which starts editing (for editable cards).
// Moving the pointer starts a drag straight away, so dragging never waits on a timer.
// Holding still for longer than CLICK_HOLD_TIME "picks up" the card instead: it lifts, and letting go doesn't edit.
const lifted = ref(false);
const dragging = ref(false);
let pressed = false;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
// Where the click that started editing was, so the body can put the text cursor there
const caretPoint = ref<Point | null>(null);

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;

  // Touching a card brings it to the front of its layer
  board.bringToFront(props.cardId);

  // While editing, presses inside the text belong to the text (moving the cursor, selecting)
  if (isEditing.value && (event.target as Element).closest("textarea")) return;

  board.select(props.cardId);

  // Watch for the release anywhere, in case the pointer has moved off the card by then
  pressed = true;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (pressed) lifted.value = true;
  }, BOARD.CLICK_HOLD_TIME);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}

function onPointerUp(event: PointerEvent): void {
  if (!pressed) return;
  const isClick = !lifted.value;
  endPress();

  if (isClick && definition.value?.editable && !isEditing.value) {
    caretPoint.value = { x: event.clientX, y: event.clientY };
    board.startEditing(props.cardId);
  }
}

function endPress(): void {
  pressed = false;
  clearTimeout(holdTimer);
  lifted.value = false;
}

// While editing, pressing the card's frame (around the text) must not take focus away from the text,
// so the card can be moved without ending the edit
function onMouseDown(event: MouseEvent): void {
  if (isEditing.value && !(event.target as Element).closest("textarea")) event.preventDefault();
}

//============ Holding the card ============
// The drag or resize in progress, if this client is holding the card for one
let activeInteraction: { stop: () => void } | null = null;

// A drag or resize has started, so the press wasn't a click. Grab the card first:
// if someone else is holding it, the drag is refused and the card doesn't move.
function startInteraction(event: { interaction: { stop: () => void } }, mode: HoldMode): boolean {
  endPress();
  if (!board.acquire(props.cardId, mode)) {
    event.interaction.stop();
    return false;
  }

  activeInteraction = event.interaction;
  dragging.value = true;
  board.setCardInteraction(true);
  return true;
}

// The drag or resize ended. Let go of the card (writing its final state first),
// unless its text is still being edited, in which case keep holding it.
function endInteraction(): void {
  activeInteraction = null;
  dragging.value = false;
  board.setCardInteraction(false);
  if (isEditing.value) board.commit(props.cardId);
  else board.release(props.cardId);
}

// Someone else won this card while this client was grabbing it (both grabbed it at nearly the same time).
// Stop the drag or resize where it is. The store has already let go of the card.
watch(
  () => board.lostHold,
  (lost) => {
    if (lost?.cardId !== props.cardId || !activeInteraction) return;
    activeInteraction.stop();
    activeInteraction = null;
    stopEdgePan();
    dragging.value = false;
    board.setCardInteraction(false);
  },
);

//============ Content from the body ============
// While a note is being edited, its lock is let go after a while without typing (so others can use the card).
// The note stays focused, and the next keystroke takes the lock back if nobody else has taken it.
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function restartIdleTimer(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (isEditing.value) board.release(props.cardId);
  }, REALTIME.EDIT_IDLE_RELEASE);
}
watch(isEditing, (editing) => {
  if (editing) restartIdleTimer();
  else clearTimeout(idleTimer);
});

// About to change the content: make sure this client still holds the card.
// If someone else took it while this client was idle, the change is refused and editing stops.
function onBeforeInput(event: Event): void {
  if (board.isHolding(props.cardId)) return;
  if (!board.acquire(props.cardId, "edit")) {
    event.preventDefault();
    board.stopEditing(props.cardId);
  }
}

function onContent(patch: Record<string, string>): void {
  board.updateContent(props.cardId, patch);
  throttledBroadcastContent();
  debouncedPersistContent();
  restartIdleTimer();
}

// The body's content has outgrown the card, so make the card taller
// Only the client changing the card grows it (everyone else gets the new size from that client).
function onGrow(height: number): void {
  if (!card.value || !(isEditing.value || board.changedHereRecently(props.cardId))) return;
  board.updateGeometry(props.cardId, { height: card.value.height + height });
  throttledBroadcastGeometry();
  throttledPersist();
}

// Editing ended (Escape, or focus moved away). Stopping lets go of the card, writing its content first.
function onStopEditing(): void {
  board.stopEditing(props.cardId);
}

//============ Right-click menu ============
// The type's own items (such as colours), then the layer, then delete
const menuItems = computed<ContextMenuItem[][]>(() => {
  const current = card.value;
  if (!current) return [];

  return [
    definition.value?.menuItems(current, board) ?? [],
    [
      {
        label: "Layer",
        icon: "i-ph-stack",
        children: LAYERS.map((layer) => ({
          label: layer.label,
          type: "checkbox" as const,
          checked: current.layer === layer.value,
          onSelect: () => board.setLayer(props.cardId, layer.value),
        })),
      },
    ],
    [
      {
        label: "Delete",
        icon: "i-ph-trash",
        color: "error" as const,
        kbds: ["delete"],
        onSelect: () => board.deleteCard(props.cardId),
      },
    ],
  ];
});

//============ Dragging near the edge ============
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
      throttledBroadcastGeometry();
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

//============ Dragging and resizing ============
// interact.js reports pointer movement in screen pixels, so every value is divided by the camera's scale
// to convert it to world units.
onMounted(() => {
  // Ensure the card element is not null before making it interactable
  if (!cardElement.value) return;

  // While a note is being edited, dragging inside its text selects text instead of moving the card
  const ignoreFrom = ".board-card-editing textarea";

  interactable = interact(cardElement.value)
    .draggable({
      // Only the left mouse button moves cards (the middle button pans the board, even over a card)
      mouseButtons: 1,
      ignoreFrom,
      inertia: false,
      listeners: {
        // Zooming is blocked while a card is being dragged or resized
        start(event) {
          if (!startInteraction(event, "move")) return;
          dragPointer = { x: event.clientX, y: event.clientY };
          edgePanFrame = requestAnimationFrame(edgePanStep);
        },
        move(event) {
          if (!card.value || !activeInteraction) return;

          dragPointer = { x: event.clientX, y: event.clientY };
          board.updateGeometry(props.cardId, {
            x: card.value.x + event.dx / scale(),
            y: card.value.y + event.dy / scale(),
          });
          throttledBroadcastGeometry();
          throttledPersist();
        },
        end() {
          stopEdgePan();
          endInteraction();
        },
      },
    })
    .resizable({
      mouseButtons: 1,
      ignoreFrom,
      edges: { top: true, left: true, bottom: true, right: true },
      // How close (screen px) to an edge a press must be to resize instead of move. interact's default (20px)
      // would cover a note's whole frame, leaving nowhere to grab it while its text is being edited.
      margin: BOARD.RESIZE_MARGIN,
      // Stop the card from shrinking below its type's minimum size.
      // The minimum is a function so it is converted to screen pixels using the current scale.
      modifiers: [
        interact.modifiers.restrictSize({
          min: () => {
            const min = definition.value?.minSize ?? { width: 50, height: 50 };
            return { top: 0, left: 0, right: min.width * scale(), bottom: min.height * scale() };
          },
        }),
      ],
      listeners: {
        // Zooming is blocked while a card is being dragged or resized
        start(event) {
          startInteraction(event, "resize");
        },
        move(event) {
          if (!card.value || !activeInteraction) return;

          // event.rect is the card's new on-screen rect, so dividing it by the scale gives its world size
          board.updateGeometry(props.cardId, {
            width: event.rect.width / scale(),
            height: event.rect.height / scale(),
            x: card.value.x + event.deltaRect.left / scale(),
            y: card.value.y + event.deltaRect.top / scale(),
          });
          throttledBroadcastGeometry();
          throttledPersist();
        },
        end() {
          endInteraction();
        },
      },
    });
});

// Clean up the interaction listeners and timers
onUnmounted(() => {
  stopEdgePan();
  clearTimeout(holdTimer);
  clearTimeout(idleTimer);
  window.removeEventListener("pointerup", onPointerUp);
  interactable?.unset();
});
</script>

<template>
  <CardMenu v-if="card" :items="menuItems">
    <div
      class="board-card"
      :class="{
        'board-card-selected': isSelected,
        'board-card-editing': isEditing,
        'board-card-lifted': lifted || dragging,
        'board-card-frameless': definition?.frameless,
        'board-card-hollow': definition?.hollow,
      }"
      :data-card-id="card.id"
      :style="{
        transform: `translate(${card.x}px, ${card.y}px)`,
        width: card.width + 'px',
        height: card.height + 'px',
        zIndex: board.zIndexById.get(card.id),
      }"
      ref="card-element"
      @pointerdown="onPointerDown"
      @mousedown="onMouseDown"
      @contextmenu="board.select(cardId)"
    >
      <component
        :is="definition.body"
        v-if="definition"
        :card="card"
        :editable="isEditing"
        :caret-point="caretPoint"
        @content="onContent"
        @grow="onGrow"
        @before-input="onBeforeInput"
        @stop-editing="onStopEditing"
      />
    </div>
  </CardMenu>
</template>

<style>
.board-card {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 4px;
  user-select: none;
  touch-action: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.15s;
  /* The board shows a grab cursor for panning, which doesn't apply to cards */
  cursor: default;
}
.board-card-selected {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
/* Picked up (held without moving) or being dragged */
.board-card-lifted {
  cursor: grabbing;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
}
/* The body doesn't fill the card's rectangle, so a shadow here would show around nothing */
.board-card-frameless {
  box-shadow: none;
}
/* Clicks go through the card to whatever is behind it, except on the parts the body marks as clickable.
   Once the card is selected (or is being moved), all of it can be grabbed and resized.
   (!important because the right-click menu's trigger puts an inline `pointer-events: auto` on the card.) */
.board-card-hollow:not(.board-card-selected, .board-card-lifted) {
  pointer-events: none !important;
}
</style>
