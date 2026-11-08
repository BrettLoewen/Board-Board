import { defineStore } from "pinia";
import { computed, ref, shallowRef, triggerRef, type Ref } from "vue";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { supabase } from "@/lib/supabaseClient";
import { BOARD, REALTIME, ROUTES } from "@/constants";
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
import type {
  BoardTool,
  CardColor,
  CardDefaults,
  CardType,
  DrawDefaults,
  HexColor,
  NoteDefaults,
  ShapeDefaults,
} from "@/types/cards";
import { CARD_TYPES } from "@/cards/registry";
import { asObject } from "@/cards/content";
import { drawCardFromStroke, parseDrawDefaults } from "@/cards/draw";
import { parseNoteDefaults } from "@/cards/note";
import { parseShapeContent } from "@/cards/shape";
import { throttle } from "@/utils/throttle";
import { useAuthStore } from "./auth";
import {
  openBoardChannel,
  type BoardChannel,
  type StrokePreviewMessage,
} from "@/realtime/boardChannel";
import { createLockResolver, type BoardPresence, type Hold, type HoldMode } from "@/realtime/locks";

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
  const saved = asObject(value);
  return {
    note: parseNoteDefaults(saved.note),
    shape: parseShapeContent(saved.shape),
    draw: parseDrawDefaults(saved.draw),
  };
}

// A line being drawn, in world units: by this client, or by someone else (a "ghost" line)
export type Stroke = { id: string; color: CardColor; thickness: number; points: Point[] };

// Keep a value inside the range the database accepts (see the `sane_geometry` check on cards)
function clampCoordinate(value: number): number {
  return Math.min(BOARD.MAX_COORDINATE, Math.max(-BOARD.MAX_COORDINATE, value));
}

// Identifies this browser tab on a board's channel. One user with two tabs open is two clients.
const clientId = crypto.randomUUID();

// The single source of truth for everything the open board renders.
// There is only ever one board open, so the store is reset when the board page unmounts.
export const useBoardStore = defineStore("board", () => {
  const toast = useToast();
  const auth = useAuthStore();
  const router = useRouter();

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

  //============ Drawing state ============
  // What a left-button drag on the board does. Local to this user.
  const tool = ref<BoardTool>("select");
  // The line this client is drawing, and other people's lines as they draw them (by stroke id, which becomes
  // the card's id). Lines can have thousands of points, so they aren't deeply reactive: changes are announced
  // with triggerRef instead.
  const activeStroke = shallowRef<Stroke | null>(null);
  const ghostStrokes = shallowRef(new Map<string, Stroke>());
  // How many of the active line's points have been shared so far
  let strokeSentCount = 0;
  // Removes each ghost line that stops getting points (its drawer may have left)
  const ghostTimers = new Map<string, ReturnType<typeof setTimeout>>();

  //============ Collaboration state ============
  // The board's realtime channel, while the board is open
  let channel: BoardChannel | null = null;
  // Whether the channel is connected (it reconnects by itself after a dropped connection)
  const connected = ref(false);
  // Everyone with the board open (including this client), and which client holds each held card
  const presences = ref<BoardPresence[]>([]);
  const lockByCardId = ref(new Map<string, string>());
  let lockResolver = createLockResolver();
  // The card this client holds (it is moving, resizing or editing it), and whether it changed it while holding it
  const myHold = ref<Hold | null>(null);
  let holdChanged = false;
  // Set when another client wins a card this client was holding, so the card's frame can stop the interaction
  const lostHold = ref<{ cardId: string; at: number } | null>(null);
  // When this client joined the board (shared through presence)
  let joinedAt = 0;
  // Cards created here whose insert hasn't returned yet, and the insert itself. A refetch mustn't remove them,
  // and writes and deletes for them wait for the insert (otherwise they could reach the database first and miss).
  const pendingInserts = new Map<string, Promise<unknown>>();
  // Every card deleted while the board has been open, here or by someone else.
  // Database events arrive a little after the change that caused them, so an INSERT or UPDATE event can turn up
  // after its card was already deleted. Those events must not bring the card back. (Card ids are never reused.)
  const deletedCardIds = new Set<string>();
  // Cards changed here that haven't been written since
  const dirtyCards = new Set<string>();

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

    // Join the board's channel to see (and share) changes as they happen
    const opened = await openBoardChannel(id, clientId, channelHandlers);
    if (boardId.value !== id) {
      await opened.close();
      return;
    }
    channel = opened;
  }

  // Leave the board: let go of any held card (writing its final state first), then leave the channel
  async function leave(): Promise<void> {
    if (editingCardId.value) stopEditing(editingCardId.value);
    if (myHold.value) await release(myHold.value.cardId);

    const closing = channel;
    channel = null;
    reset();
    await closing?.close();
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
    connected.value = false;
    presences.value = [];
    lockByCardId.value = new Map();
    lockResolver = createLockResolver();
    myHold.value = null;
    holdChanged = false;
    lostHold.value = null;
    pendingInserts.clear();
    deletedCardIds.clear();
    dirtyCards.clear();
    tool.value = "select";
    activeStroke.value = null;
    for (const timer of ghostTimers.values()) clearTimeout(timer);
    ghostTimers.clear();
    ghostStrokes.value = new Map();
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

  // Where a new card of the given size goes: centred on the middle of the current view.
  // If a card already sits (almost) exactly there, step diagonally until there's a free spot.
  function defaultCardRect(size: { width: number; height: number }) {
    const centre = screenToWorld(
      { x: viewport.value.w / 2, y: viewport.value.h / 2 },
      camera.value,
    );
    let x = centre.x - size.width / 2;
    let y = centre.y - size.height / 2;

    const isTaken = (px: number, py: number) =>
      cardList.value.some(
        (c) => Math.abs(c.x - px) < BOARD.CREATE_OFFSET && Math.abs(c.y - py) < BOARD.CREATE_OFFSET,
      );
    while (isTaken(x, y)) {
      x += BOARD.CREATE_OFFSET;
      y += BOARD.CREATE_OFFSET;
    }
    return { x, y, ...size };
  }

  //============ Drawing ============
  // Switch what a left-button drag on the board does. Drawing starts with nothing selected,
  // and a line being drawn is dropped when the tool changes.
  function setTool(next: BoardTool): void {
    if (tool.value === next) return;
    cancelStroke();
    if (next === "draw") select(null);
    tool.value = next;
  }

  // Share the active line's points that haven't been shared yet, so others see it as it is drawn
  function sendStrokePreview(): void {
    const stroke = activeStroke.value;
    if (!stroke || strokeSentCount >= stroke.points.length) return;
    const { id, color, thickness } = stroke;
    const message: StrokePreviewMessage = {
      strokeId: id,
      color,
      thickness,
      points: stroke.points.slice(strokeSentCount),
    };
    channel?.send(REALTIME.EVENTS.STROKE_PREVIEW, message);
    strokeSentCount = stroke.points.length;
  }
  const throttledSendStrokePreview = throttle(sendStrokePreview, REALTIME.RATES.STROKE);

  // Start drawing a line at a point (in world units), with the user's current line options.
  // The line's id becomes its card's id, so others can swap the ghost line for the card when it arrives.
  function startStroke(point: Point): void {
    cancelStroke();
    const { color, thickness } = cardDefaults.value.draw;
    activeStroke.value = { id: crypto.randomUUID(), color, thickness, points: [point] };
    strokeSentCount = 0;
    throttledSendStrokePreview();
  }

  // Add points (in world units) to the line being drawn
  function extendStroke(points: Point[]): void {
    const stroke = activeStroke.value;
    if (!stroke || !points.length) return;
    stroke.points.push(...points);
    triggerRef(activeStroke);
    throttledSendStrokePreview();
  }

  // Finish the line being drawn and turn it into a draw card.
  // The new card isn't selected, so a series of lines can be drawn without each one being outlined.
  function endStroke(): void {
    const stroke = activeStroke.value;
    if (!stroke) return;
    activeStroke.value = null;
    channel?.send(REALTIME.EVENTS.STROKE_END, { strokeId: stroke.id });

    const { rect, content } = drawCardFromStroke(stroke.points, {
      color: stroke.color,
      thickness: stroke.thickness,
      scale: camera.value.scale,
    });
    createCard("draw", { id: stroke.id, rect, content, select: false });
  }

  // Drop the line being drawn, without making a card
  function cancelStroke(): void {
    const stroke = activeStroke.value;
    if (!stroke) return;
    activeStroke.value = null;
    channel?.send(REALTIME.EVENTS.STROKE_CANCEL, { strokeId: stroke.id });
  }

  // Remove someone else's ghost line (its card arrived, it was cancelled, or it stopped getting points)
  function removeGhostStroke(id: string): void {
    clearTimeout(ghostTimers.get(id));
    ghostTimers.delete(id);
    if (ghostStrokes.value.delete(id)) triggerRef(ghostStrokes);
  }

  // Remove a ghost line after a delay, unless something happens to it first
  function expireGhostStroke(id: string, delay: number): void {
    clearTimeout(ghostTimers.get(id));
    ghostTimers.set(
      id,
      setTimeout(() => removeGhostStroke(id), delay),
    );
  }

  // Someone else drew more of a line. Their card replaces the ghost line when it arrives.
  function receiveStrokePreview(message: StrokePreviewMessage): void {
    if (!Array.isArray(message.points) || cards.value.has(message.strokeId)) return;
    const ghost = ghostStrokes.value.get(message.strokeId) ?? {
      id: message.strokeId,
      color: message.color,
      thickness: message.thickness,
      points: [],
    };
    ghost.points.push(...message.points);
    ghostStrokes.value.set(ghost.id, ghost);
    triggerRef(ghostStrokes);
    expireGhostStroke(ghost.id, REALTIME.GHOST_STROKE_TIMEOUT);
  }

  // Create a new card of the given type. By default it is the type's default size, in the centre of the
  // current view, with the user's default content, and is selected. A drawing gives its own id, rect and
  // content instead (from the line), and isn't selected.
  // The card is added locally straight away, and removed again if the insert fails.
  async function createCard(
    type: CardType,
    options: {
      id?: string;
      rect?: { x: number; y: number; width: number; height: number };
      content?: Json;
      select?: boolean;
    } = {},
  ): Promise<void> {
    const definition = CARD_TYPES[type];
    if (!boardId.value || !definition) return;

    const rect = options.rect ?? defaultCardRect(definition.defaultSize);

    // The id is generated here so the card can be shown before the insert returns.
    // created_at/updated_at and the author columns are filled in by the database.
    // New cards go in the middle layer, in front of everything already there.
    const insert = {
      id: options.id ?? crypto.randomUUID(),
      board_id: boardId.value,
      type,
      content: options.content ?? definition.newContent(cardDefaults.value),
      x: clampCoordinate(rect.x),
      y: clampCoordinate(rect.y),
      width: Math.min(BOARD.MAX_COORDINATE, rect.width),
      height: Math.min(BOARD.MAX_COORDINATE, rect.height),
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
    if (options.select ?? true) select(insert.id);

    // Tell everyone else straight away, then write the card to the database.
    // (The query is wrapped in a promise so it can be awaited more than once without sending it again.)
    channel?.send(REALTIME.EVENTS.CARD_CREATE, cards.value.get(insert.id)!);
    const inserting = (async () => supabase.from("cards").insert(insert))();
    pendingInserts.set(insert.id, inserting);
    const { error } = await inserting;
    pendingInserts.delete(insert.id);

    // If the insert failed, take the card back everywhere
    if (error) {
      console.error(error);
      removeLocally(insert.id);
      channel?.send(REALTIME.EVENTS.CARD_DELETE, { id: insert.id });
      toast.error("Could not create the card!");
    }
  }

  // Delete a card, unless someone else is holding it.
  // It is removed locally (and for everyone else) straight away, and restored if the delete fails.
  async function deleteCard(id: string): Promise<void> {
    const card = cards.value.get(id);
    if (!card || isHeldByOther(id)) return;

    removeLocally(id);
    channel?.send(REALTIME.EVENTS.CARD_DELETE, { id });

    // A card deleted straight after being created must wait for its insert, or the delete would find nothing
    await pendingInserts.get(id);
    const { error } = await supabase.from("cards").delete().eq("id", id);

    if (error) {
      console.error(error);
      deletedCardIds.delete(id);
      cards.value.set(id, card);
      channel?.send(REALTIME.EVENTS.CARD_CREATE, card);
      toast.error("Could not delete the card!");
    }
  }

  // Remove a card from this client only (it was deleted, here or by someone else)
  function removeLocally(id: string): void {
    deletedCardIds.add(id);
    cards.value.delete(id);
    dirtyCards.delete(id);
    if (editingCardId.value === id) editingCardId.value = null;
    if (selectedCardId.value === id) selectedCardId.value = null;
    if (myHold.value?.cardId === id) {
      myHold.value = null;
      trackPresence();
    }
  }

  // Record a local change to a card: it gets the next rev (so everyone applies changes in order) and needs writing
  function touch(card: Card): void {
    card.rev += 1;
    dirtyCards.add(card.id);
    if (myHold.value?.cardId === card.id) holdChanged = true;
    lastLocalChange = { cardId: card.id, at: Date.now() };
  }

  // The card this client last changed, and when. Changes from others don't count.
  let lastLocalChange = { cardId: "", at: 0 };

  // Whether this client changed a card in the last second. Used where every viewer reacts to a change (such as a
  // note growing to fit a bigger text size) but only the client that made the change should act on it.
  function changedHereRecently(id: string): boolean {
    return lastLocalChange.cardId === id && Date.now() - lastLocalChange.at < 1000;
  }

  // Change a card's position and/or size locally (in world units).
  // Call persistCard to write the change to the database, and broadcastGeometry to share it.
  function updateGeometry(id: string, geometry: Partial<CardGeometry>): void {
    const card = cards.value.get(id);
    if (!card) return;
    touch(card);

    if (geometry.x !== undefined) card.x = clampCoordinate(geometry.x);
    if (geometry.y !== undefined) card.y = clampCoordinate(geometry.y);
    if (geometry.width !== undefined) card.width = Math.min(BOARD.MAX_COORDINATE, geometry.width);
    if (geometry.height !== undefined)
      card.height = Math.min(BOARD.MAX_COORDINATE, geometry.height);
  }

  // Merge changes into a card's content locally.
  // Call persistCard to write the change to the database, and broadcastContent to share it.
  function updateContent(id: string, patch: Record<string, Json | undefined>): void {
    const card = cards.value.get(id);
    if (!card) return;
    touch(card);

    const content =
      card.content && typeof card.content === "object" && !Array.isArray(card.content)
        ? card.content
        : {};
    card.content = { ...content, ...patch };
  }

  // Write a card's current state to the database. Never writes a card someone else is holding.
  // Every write carries the card's rev, so writes that arrive out of order are skipped by the database.
  // Every write also carries every field the user can change, not just the one that changed: if an older write
  // is skipped, the newer one that replaced it must not leave the older write's change behind.
  async function persistCard(id: string, retry = true): Promise<void> {
    // A card changed straight after being created must wait for its insert, or the write would find nothing
    await pendingInserts.get(id);

    const card = cards.value.get(id);
    if (!card || isHeldByOther(id)) return;

    dirtyCards.delete(id);
    const sentRev = card.rev;
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

    // Adopt the database's rev if it is higher (the database bumps it when two writes share a rev)
    const written = data[0];
    if (written) {
      if (written.rev > card.rev) card.rev = written.rev;
      return;
    }

    // No row was written. Either a newer write already landed (the database skips writes with a lower rev),
    // or the card is gone (deleted, or this user lost access to the board).
    const { data: rows } = await supabase.from("cards").select().eq("id", id).limit(1);
    const row = rows?.[0];
    if (!row) {
      removeLocally(id);
      await checkBoardAccess();
      return;
    }

    // Catch up with the newer rev. If this client still holds the card, its state is the latest, so write it again.
    const current = cards.value.get(id);
    if (current && row.rev >= sentRev) {
      current.rev = Math.max(current.rev, row.rev);
      if (retry && myHold.value?.cardId === id) {
        touch(current);
        await persistCard(id, false);
      }
    }
  }

  // The highest z-index used by any card in a layer
  function topZIndexInLayer(layer: number): number {
    let top = 0;
    for (const card of cards.value.values()) {
      if (card.layer === layer) top = Math.max(top, zIndexById.value.get(card.id) ?? 0);
    }
    return top;
  }

  // Bring a card in front of the other cards in its layer (cards come to the front when they're touched).
  // Skipped while someone else holds the card.
  function bringToFront(id: string): void {
    const card = cards.value.get(id);
    if (!card || isHeldByOther(id) || zIndexById.value.get(id) === topZIndexInLayer(card.layer))
      return;

    card.z_order = frontZOrder(card.layer, id);
    touch(card);
    broadcastGeometry(id);
    persistCard(id);
  }

  // Move a card to another layer, in front of the cards already in it. Skipped while someone else holds the card.
  function setLayer(id: string, layer: number): void {
    const card = cards.value.get(id);
    if (!card || card.layer === layer || isHeldByOther(id)) return;

    card.z_order = frontZOrder(layer, id);
    card.layer = layer;
    touch(card);
    broadcastGeometry(id);
    persistCard(id);
  }

  // Change a card's content in one go (for example, its colour from the menu), share it and write it.
  // Skipped while someone else holds the card.
  function changeContent(id: string, patch: Record<string, Json | undefined>): void {
    if (isHeldByOther(id)) return;
    updateContent(id, patch);
    broadcastContent(id);
    persistCard(id);
  }

  // Select a card (or nothing). Selecting a different card stops editing the current one.
  function select(id: string | null): void {
    if (editingCardId.value && editingCardId.value !== id) stopEditing(editingCardId.value);
    selectedCardId.value = id;
  }

  // Start editing a card's content (for example, typing in a note). The card is selected too.
  // Refused (returns false) while someone else holds the card.
  function startEditing(id: string): boolean {
    select(id);
    if (!acquire(id, "edit")) return false;
    editingCardId.value = id;
    return true;
  }

  // Stop editing a card, if it is the one being edited, and let go of it. It stays selected.
  function stopEditing(id: string): void {
    if (editingCardId.value !== id) return;
    editingCardId.value = null;
    release(id);
  }

  //============ Holding cards ============
  // Only the client holding a card changes it, so two people never overwrite each other's changes.
  // Holds are shared through presence, and every client works out the same holder for each card (see locks.ts).

  // The client holding a card: the agreed holder, or this client if it has just grabbed the card
  // and nobody else holds it yet
  function holderOf(id: string): string | undefined {
    return lockByCardId.value.get(id) ?? (myHold.value?.cardId === id ? clientId : undefined);
  }

  // Whether another client is holding a card (it can't be moved, edited or deleted here until they let go)
  function isHeldByOther(id: string): boolean {
    const holder = holderOf(id);
    return holder !== undefined && holder !== clientId;
  }

  // Whether this client is holding a card
  function isHolding(id: string): boolean {
    return myHold.value?.cardId === id && !isHeldByOther(id);
  }

  // Share this client's presence (who it is, and which card it holds)
  function trackPresence(): void {
    channel?.track(myPresence());
  }

  // This client's presence, as it is right now
  function myPresence(): BoardPresence {
    return {
      clientId,
      userId: auth.user?.id ?? "",
      username: auth.profile?.username ?? "",
      joinedAt,
      hold: myHold.value,
    };
  }

  // Grab a card to move, resize or edit it. Returns false (and grabs nothing) if someone else holds it.
  // The grab takes effect straight away, without waiting for presence to come back, so grabbing feels instant.
  // A client holds one card at a time, so grabbing another card lets go of the first.
  function acquire(id: string, mode: HoldMode): boolean {
    if (isHeldByOther(id)) return false;
    if (myHold.value?.cardId === id) return true;
    if (myHold.value) release(myHold.value.cardId);

    myHold.value = { cardId: id, mode, at: Date.now() };
    holdChanged = false;
    trackPresence();
    return true;
  }

  // Write a held card's latest state and share it, keeping hold of it (for example, after dragging a note
  // that is still being edited)
  async function commit(id: string): Promise<void> {
    await persistCard(id);
    broadcastGeometry(id);
    broadcastContent(id);
  }

  // Let go of a card. If it changed, its final state is written first and then broadcast with the rev the database
  // settled on, and only then is the hold dropped. That way whoever grabs it next starts from the latest state.
  async function release(id: string): Promise<void> {
    if (myHold.value?.cardId !== id) return;

    if (holdChanged) {
      holdChanged = false;
      await commit(id);
    }

    // Grabbing another card while this one was being written replaces the hold, so only drop it if it's still this one
    if (myHold.value?.cardId === id) {
      myHold.value = null;
      trackPresence();
    }
  }

  // Another client won a card this client had just grabbed (both grabbed it at nearly the same time).
  // Stop changing it, let go, and follow the winner from now on.
  async function loseHold(id: string): Promise<void> {
    myHold.value = null;
    holdChanged = false;
    dirtyCards.delete(id);
    if (editingCardId.value === id) editingCardId.value = null;
    lostHold.value = { cardId: id, at: Date.now() };
    trackPresence();

    // This client's rev counted its own changes, which lost. Forget it, so every change from the winner applies,
    // including any that arrive while the card is being reloaded below.
    const card = cards.value.get(id);
    if (card) card.rev = -1;

    // Catch up with the database, unless the winner's changes have already overtaken it
    const { data } = await supabase.from("cards").select().eq("id", id).limit(1);
    const row = data?.[0];
    if (row) applyRemote(id, row);
  }

  //============ Sharing changes ============
  // Broadcast a card's position, size and stacking to everyone else on the board
  function broadcastGeometry(id: string): void {
    const card = cards.value.get(id);
    if (!card || isHeldByOther(id)) return;
    const { x, y, width, height, layer, z_order, rev } = card;
    channel?.send(REALTIME.EVENTS.CARD_GEOMETRY, { id, x, y, width, height, layer, z_order, rev });
  }

  // Broadcast a card's content to everyone else on the board
  function broadcastContent(id: string): void {
    const card = cards.value.get(id);
    if (!card || isHeldByOther(id)) return;
    channel?.send(REALTIME.EVENTS.CARD_CONTENT, { id, content: card.content, rev: card.rev });
  }

  // Apply a change from someone else, if it is newer than what this client has (a higher rev).
  // A client never applies changes to the card it is holding: it is the only one changing it.
  function applyRemote(id: string, fields: Partial<Card> & { rev: number }): void {
    const card = cards.value.get(id);
    if (!card || myHold.value?.cardId === id || fields.rev <= card.rev) return;
    Object.assign(card, fields);
  }

  // A card arrived from the database or from someone else: add it if it's new, or apply it if it's newer.
  // The database never brings back a deleted card (its events can arrive after the delete). Another client can,
  // when it restores a card whose delete failed.
  function upsertRemote(row: Card, fromClient = false): void {
    if (fromClient) deletedCardIds.delete(row.id);
    else if (deletedCardIds.has(row.id)) return;
    if (cards.value.has(row.id)) applyRemote(row.id, row);
    else cards.value.set(row.id, row);
  }

  // Reload the board's cards from the database and merge them in by rev.
  // Used whenever the channel (re)connects, so nothing that changed while it was disconnected is missed.
  async function refetchCards(): Promise<void> {
    const id = boardId.value;
    if (!id) return;
    const { data, error } = await supabase.from("cards").select().eq("board_id", id);
    if (error || boardId.value !== id) {
      if (error) console.error(error);
      return;
    }

    const fetched = new Set<string>();
    for (const row of data) {
      fetched.add(row.id);
      upsertRemote(row);
    }

    // Cards that are gone from the database were deleted while this client wasn't listening
    for (const cardId of cards.value.keys()) {
      if (!fetched.has(cardId) && !pendingInserts.has(cardId)) removeLocally(cardId);
    }
  }

  // Leave the board for the dashboard, with a message saying why
  function leaveBoard(message: string): void {
    toast.info(message);
    router.push(ROUTES.DASHBOARD);
  }

  // A card write found nothing to write to. If the board itself is gone too, this user has lost access to it.
  async function checkBoardAccess(): Promise<void> {
    const id = boardId.value;
    if (!id) return;
    const { data } = await supabase.from("boards").select("id").eq("id", id).limit(1);
    if (data && data.length === 0 && boardId.value === id) {
      leaveBoard("You no longer have access to this board.");
    }
  }

  // What the board does with each message on its channel
  const channelHandlers = {
    onGeometry: (message: Partial<Card> & { id: string; rev: number }) =>
      applyRemote(message.id, message),
    onContent: (message: Partial<Card> & { id: string; rev: number }) =>
      applyRemote(message.id, message),
    onCreate: (card: Card) => {
      removeGhostStroke(card.id);
      upsertRemote(card, true);
    },
    onDelete: (id: string) => {
      if (!pendingInserts.has(id)) removeLocally(id);
    },
    onCommitted: (card: Card) => {
      removeGhostStroke(card.id);
      upsertRemote(card);
    },
    onStrokePreview: receiveStrokePreview,
    // Keep showing a finished line until its card arrives, which is usually straight away
    onStrokeEnd: (strokeId: string) => expireGhostStroke(strokeId, REALTIME.GHOST_STROKE_END_DELAY),
    onStrokeCancel: removeGhostStroke,
    onCommittedDelete: removeLocally,
    onBoardDeleted: () => leaveBoard("This board was deleted."),
    onAccessRevoked: (userId: string) => {
      if (userId === auth.user?.id) leaveBoard("You no longer have access to this board.");
    },
    onPresence: (list: BoardPresence[]) => {
      // Work out the locks with this client's own hold as it is right now. A presence update can arrive with
      // another client's grab before this client's own grab has come back from the server. Judging the contest
      // from that alone would make this client let go of a card it actually won.
      const others = list.filter((presence) => presence.clientId !== clientId);
      presences.value = [...others, myPresence()];
      lockByCardId.value = lockResolver.update(presences.value);

      // If someone else won the card this client is holding, let go of it
      const hold = myHold.value;
      if (hold && isHeldByOther(hold.cardId)) loseHold(hold.cardId);
    },
    onConnected: () => {
      connected.value = true;
      if (!joinedAt) joinedAt = Date.now();
      // Catch up on anything missed, then share this client's presence (including any card it was holding,
      // which the rules in locks.ts give back to it only if nobody else took it in the meantime)
      refetchCards();
      trackPresence();
    },
    onDisconnected: () => {
      connected.value = false;
    },
  };

  // Change the options this user's new notes start with, and save them to their preferences
  function setNoteDefaults(patch: Partial<NoteDefaults>): Promise<void> {
    cardDefaults.value = {
      ...cardDefaults.value,
      note: { ...cardDefaults.value.note, ...patch },
    };
    return saveCardDefaults();
  }

  // Change the options this user's new shapes start with, and save them to their preferences
  function setShapeDefaults(patch: Partial<ShapeDefaults>): Promise<void> {
    cardDefaults.value = {
      ...cardDefaults.value,
      shape: { ...cardDefaults.value.shape, ...patch },
    };
    return saveCardDefaults();
  }

  // Change the line options this user's next drawings start with, and save them to their preferences
  function setDrawDefaults(patch: Partial<DrawDefaults>): Promise<void> {
    cardDefaults.value = {
      ...cardDefaults.value,
      draw: { ...cardDefaults.value.draw, ...patch },
    };
    return saveCardDefaults();
  }

  // Save this user's card defaults to their preferences
  async function saveCardDefaults(): Promise<void> {
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
    connected,
    presences,
    lockByCardId,
    myHold,
    lostHold,
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
    leave,
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
    changeContent,
    bringToFront,
    setLayer,
    isHeldByOther,
    isHolding,
    changedHereRecently,
    acquire,
    commit,
    release,
    broadcastGeometry,
    broadcastContent,
    select,
    startEditing,
    stopEditing,
    setNoteDefaults,
    setShapeDefaults,
    setDrawDefaults,
    tool,
    activeStroke,
    ghostStrokes,
    setTool,
    startStroke,
    extendStroke,
    endStroke,
    cancelStroke,
    requestCustomColor,
    closeCustomColor,
    updateGeometry,
    persistCard,
  };
});

// The board store's type, for modules that receive the store (such as the card type registry)
export type BoardStore = ReturnType<typeof useBoardStore>;
