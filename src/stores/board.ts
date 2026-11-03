import { defineStore } from "pinia";
import { computed, ref, type Ref } from "vue";
import { useToast } from "vue-toastification";
import { supabase } from "@/lib/supabaseClient";
import { BOARD } from "@/constants";
import {
  clamp,
  clampCamera,
  expandRect,
  screenToWorld,
  unionRect,
  viewRect,
  zoomAround,
  type Camera,
  type Point,
  type Rect,
  type Viewport,
} from "@/utils/camera";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/types/database.types";
import type { CardColor, CardDefaults, CardType, HexColor, NoteDefaults } from "@/types/cards";
import { CARD_TYPES } from "@/cards/registry";
import { parseNoteDefaults } from "@/cards/note";
import { useAuthStore } from "./auth";

export type Card = Tables<"cards">;

// The fields of a card that describe where it is on the board and how big it is
export type CardGeometry = Pick<Card, "x" | "y" | "width" | "height">;

// A request to open the custom colour picker (see CardColorModal.vue)
export type CustomColorRequest = {
  title: string;
  color: CardColor;
  apply: (color: HexColor) => void;
};

// Read the user's saved card defaults, falling back to the built-in defaults for anything missing or invalid
function parseCardDefaults(value: Json | undefined): CardDefaults {
  const note = value && typeof value === "object" && !Array.isArray(value) ? value.note : undefined;
  return { note: parseNoteDefaults(note) };
}

// Keep a value inside the range the database accepts (see the `sane_geometry` check on cards)
function clampCoordinate(value: number): number {
  return Math.min(BOARD.MAX_COORDINATE, Math.max(-BOARD.MAX_COORDINATE, value));
}

// The single source of truth for everything the open board renders.
// There is only ever one board open, so the store is reset when the board page unmounts.
export const useBoardStore = defineStore("board", () => {
  const toast = useToast();
  const auth = useAuthStore();

  // The board that is open, and the cards it holds (keyed by card id)
  const boardId = ref<string | null>(null);
  const board = ref<Tables<"boards"> | null>(null);
  // Typed by hand because unwrapping the recursive `Json` content type is too deep for TypeScript
  const cards = ref(new Map()) as Ref<Map<string, Card>>;

  // Set once the board and its cards have been fetched
  const loaded = ref(false);

  // The local view of the board. Never shared with other users.
  const camera = ref<Camera>({ x: 0, y: 0, scale: 1 });
  // The size of the board viewport element in screen pixels (measured by DigitalBoard)
  const viewport = ref<Viewport>({ w: 0, h: 0 });
  // Whether a card is being dragged or resized. Zooming is blocked while it is, because interact.js
  // tracks the interaction in screen pixels and zooming would make that stale.
  const cardInteraction = ref(false);

  // The selected card (outlined, and the target of the Delete key), and the card whose text is being edited.
  // Both are local to this user and never shared.
  const selectedCardId = ref<string | null>(null);
  const editingCardId = ref<string | null>(null);

  // The colours this user's new cards start with. Updated whenever they pick a colour, and saved to their preferences.
  const cardDefaults = ref<CardDefaults>(parseCardDefaults(undefined));

  // Set while the custom colour picker is open
  const customColorRequest = ref<CustomColorRequest | null>(null);

  // The cards as an array, for rendering
  const cardList = computed(() => Array.from(cards.value.values()));

  // Each card's stacking order: by layer, then by last touched within the layer (z_order), then by id to break ties.
  // Applied as a CSS z-index, so the cards are never reordered in the DOM (which could blur a note being edited).
  const zIndexById = computed(() => {
    const sorted = [...cardList.value].sort(
      (a, b) => a.layer - b.layer || a.z_order - b.z_order || a.id.localeCompare(b.id),
    );
    return new Map(sorted.map((card, index) => [card.id, index + 1]));
  });

  // The area covered by the cards plus a margin, or null if there are no cards.
  // Kept separate from the bounds so panning (which changes the camera) doesn't loop over every card.
  const contentRect = computed<Rect | null>(() => {
    let rect: Rect | null = null;
    for (const card of cards.value.values()) {
      const cardRect = { x: card.x, y: card.y, w: card.width, h: card.height };
      rect = rect ? unionRect(rect, cardRect) : cardRect;
    }
    return rect ? expandRect(rect, BOARD.MARGIN) : null;
  });

  // The board's starting area, centred on the origin. At least as big as the viewport at 100% zoom.
  const minBounds = computed<Rect>(() => {
    const w = Math.max(BOARD.START_SIZE.w, viewport.value.w);
    const h = Math.max(BOARD.START_SIZE.h, viewport.value.h);
    return { x: -w / 2, y: -h / 2, w, h };
  });

  // The area the board should cover: the starting area plus every card (with a margin)
  const targetBounds = computed<Rect>(() =>
    contentRect.value ? unionRect(minBounds.value, contentRect.value) : minBounds.value,
  );

  // The area the camera is allowed to see.
  // It includes the current view, so the board never shrinks while the shrinking part is on screen.
  // Once the camera moves away, the next recompute drops that part.
  const bounds = computed<Rect>(() =>
    unionRect(targetBounds.value, viewRect(camera.value, viewport.value)),
  );

  // The furthest the camera can zoom out: far enough for the whole board to fit, but no further
  const minScale = computed(() => {
    const { w, h } = viewport.value;
    const target = targetBounds.value;
    if (!w || !h) return BOARD.MIN_SCALE;
    return Math.min(
      BOARD.MAX_SCALE,
      Math.max(BOARD.MIN_SCALE, Math.min(w / target.w, h / target.h)),
    );
  });

  // Load the board and its cards
  async function load(id: string): Promise<void> {
    reset();
    boardId.value = id;

    const [boardResult, cardsResult, preferencesResult] = await Promise.all([
      supabase.from("boards").select().eq("id", id).limit(1),
      supabase.from("cards").select().eq("board_id", id),
      // RLS only returns the user's own preferences
      supabase.from("user_preferences").select("card_defaults").limit(1),
    ]);

    // Ignore the results if another board was opened while these were loading
    if (boardId.value !== id) return;

    if (boardResult.error) console.error(boardResult.error);
    else board.value = boardResult.data[0] ?? null;

    if (cardsResult.error) console.error(cardsResult.error);
    else cards.value = new Map(cardsResult.data.map((card) => [card.id, card]));

    if (preferencesResult.error) console.error(preferencesResult.error);
    else cardDefaults.value = parseCardDefaults(preferencesResult.data[0]?.card_defaults);

    loaded.value = true;
  }

  // Clear everything about the open board
  function reset(): void {
    boardId.value = null;
    board.value = null;
    cards.value = new Map();
    loaded.value = false;
    camera.value = { x: 0, y: 0, scale: 1 };
    cardInteraction.value = false;
    selectedCardId.value = null;
    editingCardId.value = null;
    customColorRequest.value = null;
  }

  // Move the camera by a distance in screen pixels (dragging the board right moves the camera left)
  function panBy(dx: number, dy: number): void {
    // Clamp against the bounds as they were before the move.
    // The bounds include the view, so clamping against the bounds after the move would do nothing.
    const before = bounds.value;
    const { x, y, scale } = camera.value;
    camera.value = clampCamera(
      { x: x - dx / scale, y: y - dy / scale, scale },
      before,
      viewport.value,
    );
  }

  // Pan the camera while a card is dragged near the edge of the viewport, carrying the card with it so
  // it stays under the pointer. Moving the card grows the board (its margin reaches past the view),
  // which makes room for the next pan, so the board grows only as fast as the pan speed allows.
  // Returns whether anything moved.
  function edgePan(cardId: string, dx: number, dy: number): boolean {
    const card = cards.value.get(cardId);
    if (!card) return false;

    const before = camera.value;
    panBy(dx, dy);
    const movedX = camera.value.x - before.x;
    const movedY = camera.value.y - before.y;
    if (!movedX && !movedY) return false;

    updateGeometry(cardId, { x: card.x + movedX, y: card.y + movedY });
    return true;
  }

  // Zoom to a new scale, keeping the world point under the given screen point in place
  function zoomAt(screenPoint: Point, scale: number): void {
    if (cardInteraction.value) return;

    const before = bounds.value;
    const newScale = clamp(scale, minScale.value, BOARD.MAX_SCALE);
    camera.value = clampCamera(
      zoomAround(camera.value, screenPoint, newScale),
      before,
      viewport.value,
    );
  }

  // Zoom to a new scale around the centre of the viewport (used by the zoom slider)
  function zoomToScale(scale: number): void {
    zoomAt({ x: viewport.value.w / 2, y: viewport.value.h / 2 }, scale);
  }

  // Record the viewport's new size and keep the camera inside the board
  function setViewport(size: Viewport): void {
    const old = viewport.value;
    viewport.value = size;

    // Keep the world point at the centre of the view in the centre when the window is resized.
    // Otherwise the top-left corner stays put and the centre drifts, so new cards (which appear at the centre)
    // would no longer line up with the centre of the board. Skipped for the first measurement (no old size).
    let cam = camera.value;
    if (old.w && old.h) {
      cam = {
        x: cam.x + (old.w - size.w) / 2 / cam.scale,
        y: cam.y + (old.h - size.h) / 2 / cam.scale,
        scale: cam.scale,
      };
    }

    // Clamp against the target bounds, because the bounds always contain the view
    camera.value = clampCamera(cam, targetBounds.value, size);
  }

  // Show every card (or the origin on an empty board).
  // Never zooms in past 100%, so a single card doesn't fill the screen.
  function fitToContent(): void {
    const { w, h } = viewport.value;
    if (!w || !h) return;

    const content = contentRect.value;
    let cam: Camera;
    if (content) {
      const scale = clamp(
        Math.min(w / content.w, h / content.h, 1),
        minScale.value,
        BOARD.MAX_SCALE,
      );
      // Put the centre of the content in the centre of the viewport
      cam = {
        x: content.x + content.w / 2 - w / 2 / scale,
        y: content.y + content.h / 2 - h / 2 / scale,
        scale,
      };
    } else {
      cam = { x: -w / 2, y: -h / 2, scale: 1 };
    }

    camera.value = clampCamera(cam, targetBounds.value, viewport.value);
  }

  // Mark a card drag or resize as started or ended
  function setCardInteraction(active: boolean): void {
    cardInteraction.value = active;
  }

  // The z_order that puts a card in front of every other card in a layer
  function frontZOrder(layer: number, exceptId?: string): number {
    let max = 0;
    for (const card of cards.value.values()) {
      if (card.layer === layer && card.id !== exceptId) max = Math.max(max, card.z_order);
    }
    return max + 1;
  }

  // Create a new card of the given type in the centre of the current view.
  // The card is added locally straight away (and selected), and removed again if the insert fails.
  async function createCard(type: CardType): Promise<void> {
    const definition = CARD_TYPES[type];
    if (!boardId.value || !definition) return;

    const { width, height } = definition.defaultSize;

    // Find the world point at the centre of the viewport, and put the card's centre on it
    const centre = screenToWorld(
      { x: viewport.value.w / 2, y: viewport.value.h / 2 },
      camera.value,
    );
    let x = centre.x - width / 2;
    let y = centre.y - height / 2;

    // If a card already sits (almost) exactly there, step diagonally until there's a free spot
    const isTaken = (px: number, py: number) =>
      cardList.value.some(
        (c) => Math.abs(c.x - px) < BOARD.CREATE_OFFSET && Math.abs(c.y - py) < BOARD.CREATE_OFFSET,
      );
    while (isTaken(x, y)) {
      x += BOARD.CREATE_OFFSET;
      y += BOARD.CREATE_OFFSET;
    }

    // The id is generated here so the card can be shown before the insert returns.
    // created_at/updated_at and the author columns are filled in by the database.
    // New cards go in the middle layer, in front of everything already there.
    const insert = {
      id: crypto.randomUUID(),
      board_id: boardId.value,
      type,
      content: definition.newContent(cardDefaults.value),
      x: clampCoordinate(x),
      y: clampCoordinate(y),
      width,
      height,
      layer: 1,
      z_order: frontZOrder(1),
      rev: 0,
    } satisfies TablesInsert<"cards">;

    // Show the card locally straight away
    const now = new Date().toISOString();
    cards.value.set(insert.id, {
      ...insert,
      created_at: now,
      updated_at: now,
      created_by: null,
      updated_by: null,
    });
    select(insert.id);

    // Write the card to the database
    const { error } = await supabase.from("cards").insert(insert);

    if (error) {
      console.error(error);
      cards.value.delete(insert.id);
      if (selectedCardId.value === insert.id) select(null);
      toast.error("Could not create the card!");
    }
  }

  // Delete a card. It is removed locally straight away, and restored if the delete fails.
  async function deleteCard(id: string): Promise<void> {
    const card = cards.value.get(id);
    if (!card) return;

    cards.value.delete(id);
    if (selectedCardId.value === id) select(null);

    const { error } = await supabase.from("cards").delete().eq("id", id);

    if (error) {
      console.error(error);
      cards.value.set(id, card);
      toast.error("Could not delete the card!");
    }
  }

  // Change a card's position and/or size locally (in world units).
  // Call persistCard to write the change to the database.
  function updateGeometry(id: string, geometry: Partial<CardGeometry>): void {
    const card = cards.value.get(id);
    if (!card) return;

    if (geometry.x !== undefined) card.x = clampCoordinate(geometry.x);
    if (geometry.y !== undefined) card.y = clampCoordinate(geometry.y);
    if (geometry.width !== undefined) card.width = Math.min(BOARD.MAX_COORDINATE, geometry.width);
    if (geometry.height !== undefined)
      card.height = Math.min(BOARD.MAX_COORDINATE, geometry.height);
  }

  // Merge changes into a card's content locally. Call persistCard to write the change to the database.
  function updateContent(id: string, patch: Record<string, Json | undefined>): void {
    const card = cards.value.get(id);
    if (!card) return;

    const content =
      card.content && typeof card.content === "object" && !Array.isArray(card.content)
        ? card.content
        : {};
    card.content = { ...content, ...patch };
  }

  // Write a card's current state to the database.
  // Every write carries the next rev, so writes that arrive out of order are skipped by the database.
  // Every write also carries every field the user can change, not just the one that changed: if an older write
  // is skipped, the newer one that replaced it must not leave the older write's change behind.
  async function persistCard(id: string): Promise<void> {
    const card = cards.value.get(id);
    if (!card) return;

    card.rev += 1;
    const update: TablesUpdate<"cards"> = {
      x: card.x,
      y: card.y,
      width: card.width,
      height: card.height,
      content: card.content,
      layer: card.layer,
      z_order: card.z_order,
      rev: card.rev,
    };

    const { data, error } = await supabase
      .from("cards")
      .update(update)
      .eq("id", id)
      .select("id, rev");

    if (error) {
      console.error(error);
      return;
    }

    // Adopt the database's rev if it is higher (the database bumps it when two writes share a rev).
    // TODO (basic collaboration): a write that returns 0 rows needs to re-select the card (Plan 6.4).
    const written = data[0];
    if (written && written.rev > card.rev) card.rev = written.rev;
  }

  // The highest z-index used by any card in a layer
  function topZIndexInLayer(layer: number): number {
    let top = 0;
    for (const card of cards.value.values()) {
      if (card.layer === layer) top = Math.max(top, zIndexById.value.get(card.id) ?? 0);
    }
    return top;
  }

  // Bring a card in front of the other cards in its layer (cards come to the front when they're touched)
  function bringToFront(id: string): void {
    const card = cards.value.get(id);
    if (!card || zIndexById.value.get(id) === topZIndexInLayer(card.layer)) return;

    card.z_order = frontZOrder(card.layer, id);
    persistCard(id);
  }

  // Move a card to another layer, in front of the cards already in it
  function setLayer(id: string, layer: number): void {
    const card = cards.value.get(id);
    if (!card || card.layer === layer) return;

    card.z_order = frontZOrder(layer, id);
    card.layer = layer;
    persistCard(id);
  }

  // Select a card (or nothing). Selecting a different card stops editing the current one.
  function select(id: string | null): void {
    selectedCardId.value = id;
    if (editingCardId.value !== id) editingCardId.value = null;
  }

  // Start editing a card's content (for example, typing in a note). The card is selected too.
  function startEditing(id: string): void {
    select(id);
    editingCardId.value = id;
  }

  // Stop editing a card, if it is the one being edited. It stays selected.
  function stopEditing(id: string): void {
    if (editingCardId.value === id) editingCardId.value = null;
  }

  // Change the colours this user's new notes start with, and save them to their preferences
  async function setNoteDefaults(patch: Partial<NoteDefaults>): Promise<void> {
    cardDefaults.value = {
      ...cardDefaults.value,
      note: { ...cardDefaults.value.note, ...patch },
    };

    if (!auth.user) return;
    const { error } = await supabase
      .from("user_preferences")
      .update({ card_defaults: cardDefaults.value })
      .eq("user_id", auth.user.id);
    if (error) console.error(error);
  }

  // Open the custom colour picker. `apply` is called with the colour the user picks, if they pick one.
  function requestCustomColor(request: CustomColorRequest): void {
    customColorRequest.value = request;
  }

  // Close the custom colour picker
  function closeCustomColor(): void {
    customColorRequest.value = null;
  }

  return {
    boardId,
    board,
    cards,
    loaded,
    camera,
    viewport,
    cardInteraction,
    selectedCardId,
    editingCardId,
    cardDefaults,
    customColorRequest,
    cardList,
    zIndexById,
    contentRect,
    targetBounds,
    bounds,
    minScale,
    load,
    reset,
    panBy,
    edgePan,
    zoomAt,
    zoomToScale,
    setViewport,
    fitToContent,
    setCardInteraction,
    createCard,
    deleteCard,
    updateContent,
    bringToFront,
    setLayer,
    select,
    startEditing,
    stopEditing,
    setNoteDefaults,
    requestCustomColor,
    closeCustomColor,
    updateGeometry,
    persistCard,
  };
});

// The board store's type, for modules that receive the store (such as the card type registry)
export type BoardStore = ReturnType<typeof useBoardStore>;
