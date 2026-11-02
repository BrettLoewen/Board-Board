import { defineStore } from "pinia";
import { computed, ref, type Ref } from "vue";
import { useToast } from "vue-toastification";
import { supabase } from "@/lib/supabaseClient";
import { BOARD } from "@/constants";
import { screenToWorld, type Camera } from "@/utils/camera";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

export type Card = Tables<"cards">;

// The fields of a card that describe where it is on the board and how big it is
export type CardGeometry = Pick<Card, "x" | "y" | "width" | "height">;

// Keep a value inside the range the database accepts (see the `sane_geometry` check on cards)
function clampCoordinate(value: number): number {
  return Math.min(BOARD.MAX_COORDINATE, Math.max(-BOARD.MAX_COORDINATE, value));
}

// The single source of truth for everything the open board renders.
// There is only ever one board open, so the store is reset when the board page unmounts.
export const useBoardStore = defineStore("board", () => {
  const toast = useToast();

  // The board that is open, and the cards it holds (keyed by card id)
  const boardId = ref<string | null>(null);
  const board = ref<Tables<"boards"> | null>(null);
  // Typed by hand because unwrapping the recursive `Json` content type is too deep for TypeScript
  const cards = ref(new Map()) as Ref<Map<string, Card>>;

  // The local view of the board. Never shared with other users.
  const camera = ref<Camera>({ x: 0, y: 0, scale: 1 });
  // The size of the board viewport element in screen pixels (measured by DigitalBoard)
  const viewport = ref({ w: 0, h: 0 });

  // The cards as an array, for rendering
  const cardList = computed(() => Array.from(cards.value.values()));

  // Load the board and its cards
  async function load(id: string): Promise<void> {
    reset();
    boardId.value = id;

    const [boardResult, cardsResult] = await Promise.all([
      supabase.from("boards").select().eq("id", id).limit(1),
      supabase.from("cards").select().eq("board_id", id),
    ]);

    // Ignore the results if another board was opened while these were loading
    if (boardId.value !== id) return;

    if (boardResult.error) console.error(boardResult.error);
    else board.value = boardResult.data[0] ?? null;

    if (cardsResult.error) console.error(cardsResult.error);
    else cards.value = new Map(cardsResult.data.map((card) => [card.id, card]));
  }

  // Clear everything about the open board
  function reset(): void {
    boardId.value = null;
    board.value = null;
    cards.value = new Map();
    camera.value = { x: 0, y: 0, scale: 1 };
  }

  // Create a new card in the centre of the current view.
  // The card is added locally straight away and removed again if the insert fails.
  async function createCard(): Promise<void> {
    if (!boardId.value) return;

    const { width, height } = BOARD.CARD_DEFAULT_SIZE;

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
    const insert = {
      id: crypto.randomUUID(),
      board_id: boardId.value,
      type: "note",
      content: {},
      x: clampCoordinate(x),
      y: clampCoordinate(y),
      width,
      height,
      layer: 1,
      z_order: 0,
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

    // Write the card to the database
    const { error } = await supabase.from("cards").insert(insert);

    if (error) {
      console.error(error);
      cards.value.delete(insert.id);
      toast.error("Could not create the card!");
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

  // Write a card's current geometry to the database.
  // Every write carries the next rev, so writes that arrive out of order are skipped by the database.
  async function persistCard(id: string): Promise<void> {
    const card = cards.value.get(id);
    if (!card) return;

    card.rev += 1;
    const update: TablesUpdate<"cards"> = {
      x: card.x,
      y: card.y,
      width: card.width,
      height: card.height,
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

  return {
    boardId,
    board,
    cards,
    camera,
    viewport,
    cardList,
    load,
    reset,
    createCard,
    updateGeometry,
    persistCard,
  };
});
