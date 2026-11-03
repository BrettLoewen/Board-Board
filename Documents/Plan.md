# Board Board Technical Plan

This is the technical companion to `Requirements.md`. It describes how the board, the cards and the collaborative features should be built so that each branch can pick up a slice of it without painting the next one into a corner. Requirement IDs (N1, B3, C3, …) are referenced throughout.

It is a guideline, not a contract. When an implementation finds a better approach, update this file in the same branch so it stays the source of truth.

---

## 0. How to use this document

- **Section 1** lists the decisions already made, and the defaults this plan assumes that have not been explicitly confirmed. Check that list before starting work and ask about anything marked _unconfirmed_ that the work depends on.
- **Sections 2–4** are the foundation: the coordinate model, the camera and board bounds, and the card model. Everything else builds on them.
- **Section 5** summarises how cards and the board interact.
- **Sections 6–8** cover collaboration: the realtime channel, presence and locks, and how remote changes flow into board state.
- **Section 9** maps the work onto branches and describes testing. **Section 10** lists known risks and existing code that needs cleaning up.

### Glossary

| Term                | Meaning                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **World**           | The board's coordinate space. Card `x/y/width/height` are world units. Unbounded and can be negative.   |
| **Screen**          | CSS pixels inside the board viewport element.                                                           |
| **Camera**          | `{ x, y, scale }`. The world point shown at the viewport's top-left corner, and the zoom.               |
| **View rect**       | The world rectangle currently visible: `{ x, y, w: vpW / scale, h: vpH / scale }`.                      |
| **Content bounds**  | The union of all card rects.                                                                            |
| **Board bounds**    | The world rectangle the camera is allowed to see (Section 3.2). Never shown as a visible edge.          |
| **Holder / lock**   | The client currently moving, resizing or editing a card. Everyone else sees the card as locked.         |
| **Ephemeral event** | A realtime broadcast that is not persisted (drag frames, cursor positions, text-in-progress).           |
| **Rev**             | A per-card, monotonically increasing revision number used to order updates (Section 6.4).               |

---

## 1. Decisions

### 1.1 Confirmed with Brett

| Topic                | Decision                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board edge (B1)      | FigJam-like. **No visible edge.** The camera hits an invisible edge when panning or zooming out too far. The board has a fixed starting size it never shrinks below (bigger than a typical large window, and at least as big as the user's window at 100% zoom). It grows when cards move into the margin. It shrinks when the defining card moves inward or is deleted, but **never while the shrinking region is on screen**: it shrinks once the camera has moved away. |
| Card storage         | One `cards` table: shared geometry columns plus a `type` and a `content jsonb` column whose shape depends on the type.                                                                                                                                                                                       |
| Locking (C3)         | **Presence-based soft locks.** No lock columns in the database.                                                                                                                                                                                                                                              |
| Stacking             | A small fixed set of **layers** (Back / Middle / Front, chosen from the right-click menu). Within a layer, **last touched comes to front**.                                                                                                                                                                  |
| Draw card resize     | Points scale with the card. **Stroke thickness stays what the user picked.**                                                                                                                                                                                                                                 |
| Note text lock       | The lock is held while the textarea is focused, and released on blur **or after ~10 s without typing**. After an idle release the note stays focused and quietly re-takes the lock on the next keypress, refusing if someone else took it (7.2).                                                                                                                                                                                                     |
| Live drawing         | Other users see an in-progress stroke live (a ghost stroke) before it becomes a card.                                                                                                                                                                                                                        |
| Wheel (B3)           | The mouse wheel **and** trackpad two-finger scroll always zoom around the cursor. Pinch (`ctrlKey` wheel) zooms too. There is no wheel-to-pan, so panning is click-drag only.                                                                                                                                   |
| Max zoom-out (B4)    | At maximum zoom-out the **whole board always fits**. On a tall or wide board, the view extends past the bounds on the shorter axis (just more dots) and stays centred on that axis (3.3).                                                                                                                       |
| Shape choice (S2)    | The toolbar creates a default shape (square), and the shape is changed afterwards from the right-click menu, as in the prototype.                                                                                                                                                                                |
| Busy guard           | The basic-board branch already **refuses a drag on a card someone else is holding**, using presence holds, without any visual indicator. Lock visuals come with the collaboration branch.                                                                                                                       |
| Pan input (B2)       | Left-drag on **empty board** pans when the Select tool is active. **Middle-drag pans in any tool**, including over cards. Left-drag on a card moves the card. (Was A1.) |
| Camera on open (B4)  | Fit content bounds plus margin into the viewport, **capped at 100% zoom**. An empty board opens centred on the origin at 100%. The camera is not persisted. (Was A6.) |
| Edge auto-pan        | **In scope** (was A7, not in scope). Dragging a card within 50 px of the viewport edge pans the camera that way (up to 800 px/s) and carries the card with it, so the board grows as the card moves into the margin. Drag only: resizing near the edge does not pan, because interact's resize rect is in screen pixels. |
| Zoom input           | Clicking the zoom percentage turns it into a text field. Enter or blur applies it (clamped to the zoom range), Escape cancels. |
| Note editing (A3)    | Movement decides, not a timer: moving the pointer 4 px after pressing starts a drag straight away. Releasing within **300 ms** without moving is a click, which enters text edit mode with the cursor where you clicked. Holding still past 300 ms "picks up" the card (it lifts) and releasing doesn't edit. While editing, drags inside the text select text, and the frame around the text still moves the card. Escape, or clicking elsewhere, stops editing. (300 ms is below the usual OS long-press of 400–500 ms but well above a normal click.) |
| Card colours (A4/A5) | A palette of named colours (auto, yellow, orange, pink, purple, blue, green, gray), each with light and dark shades, stored by name. Plus **Custom…**, a colour picker with a hex field, stored as `#rrggbb` (same in both modes). `auto` text picks a readable colour for the card. Picked text colours use a stronger shade of the palette colour. |
| Card defaults        | New notes use the colours and text size the user **last picked** (saved per card type in `user_preferences.card_defaults`, so shapes and drawings get their own). Before any pick, notes are **green** with auto text at size 16. The toolbar's Note button is drawn in the default colours (the text size doesn't show on it), and right-clicking it changes the defaults ahead of time. |
| Note text size       | Chosen from the right-click menu: a field to type any size (6–200, Enter or clicking away applies it), above presets 12–64. Sizes are in world units, so text scales with the zoom. A bigger size grows the note to fit. |
| Note auto-grow (A9)  | A note **grows taller** when its text overflows, while it is being edited. It never shrinks on its own. |

### 1.2 Defaults assumed by this plan (_unconfirmed_, ask before relying on them)

| #  | Topic                       | Assumed default                                                                                                                                                                                         | Why                                                                                         |
| -- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A8 | User colour (C4)            | Derived deterministically from the user id (a hash into a ~12-colour palette). Not stored and not user-pickable.                                                                                         | Every client computes the same colour with no schema change. Collisions are possible.       |

### 1.3 Open questions

None at the moment. Add new ones here as they come up.

---

## 2. Coordinate model and rendering

### 2.1 One world, one camera

All card geometry is stored in **world units**. The world is unbounded and coordinates can be negative. There is no "board element" sized to the board, and nothing is positioned relative to a growing DOM box. This removes the prototype's `growthPan` / `offsetPos` corrections, which existed because cards were positioned inside a box that grew to the left and top.

```
<div class="board-viewport">            ← fills the area below the navbar, overflow: hidden
  <div class="board-dots" />            ← screen-space dot grid (Section 2.4), not transformed
  <div class="board-world"              ← transform: translate(-cam.x*s, -cam.y*s) scale(s)
       style="transform-origin: 0 0">
    <BaseCard v-for=... />              ← each card: position:absolute; transform: translate(x, y)
    <DrawPreview />                     ← in-progress and remote ghost strokes, in world units
  </div>
  <RemoteCursors />                     ← screen space, positions converted from world (Section 7.3)
  <ZoomControl />  <PresenceBar />      ← overlay UI
</div>
```

Conversion helpers live in one pure module (`src/utils/camera.ts`) and are used everywhere. No component does its own camera maths:

```ts
screenToWorld(p, cam) = { x: cam.x + p.x / cam.scale, y: cam.y + p.y / cam.scale }
worldToScreen(p, cam) = { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale }
```

Screen points are relative to the viewport's `getBoundingClientRect()`, not to the window, because the navbar sits above the viewport.

### 2.2 Geometry precision

`cards.x/y/width/height` are `int` today. With zoom, a drag frame moves a card by fractional world units, and the debounced "re-read from DB" pattern would snap a card back by up to a unit on every re-read. **Migrate these columns to `double precision`** (Section 4.2). The client keeps full precision, and no rounding anywhere means no drift between local and remote state.

### 2.3 interact.js inside a scaled layer

interact.js reports pointer deltas in **screen pixels**. Every listener converts them to world units by dividing by `scale`:

- **drag:** `x += event.dx / scale`, `y += event.dy / scale`
- **resize:** `width = event.rect.width / scale`, `height = event.rect.height / scale`, `x += event.deltaRect.left / scale`, `y += event.deltaRect.top / scale`. `event.rect` is the correct on-screen rect, so dividing it by the scale gives world size.
- **minimum size:** use interact's `restrictSize` modifier with a **function**, so it reads the current scale: `min: () => ({ width: minW * scale(), height: minH * scale() })`. Clamping inside the listener instead lets interact's internal rect keep shrinking or inverting past the clamp, and the card then jumps when the pointer comes back.
- **resize edge margin:** interact's `margin` option is in screen pixels, which is what we want: grab handles stay the same size on screen at any zoom.
- **Block wheel zoom while a resize or drag is active.** interact's start rect is in screen pixels, and zooming mid-gesture makes it stale.
- Read `scale` from the store **at event time**, not from a value captured when the listener was set up.
- Set `mouseButtons: 1` (left only) on the card interactables, so a middle-drag over a card pans the board instead.

### 2.4 Dot grid (B5)

The dots are drawn in **screen space** on a non-transformed layer, using CSS background gradients driven by CSS custom properties that update when the camera changes. They are infinite by construction, so they never reveal an edge, and they cost almost nothing to repaint.

Level-of-detail maths, with `G` the base world spacing (for example 32):

```
L      = log2(scale)
level  = floor(L)
t      = L - level                      // 0..1, progress through the current octave
coarse = G * 2^t                        // screen spacing of the coarse grid, always in [G, 2G)
fine   = coarse / 2                     // the half-spacing grid that fades in or out
fineOpacity  = smoothstep(0, 1, t)                  // 0 just after a level change, 1 just before the next
coarseRadius = R * (1 + a * sin(π t))               // grows mid-octave, back to R at both ends (a ≈ 0.4)
fineRadius   = R * t                                // grows from nothing to R
origin = worldToScreen({0, 0})                      // dots are drawn at origin + k * spacing
```

**Seamless handover constraint:** at `t → 1` the coarse and fine dots must both equal the next level's coarse dots at `t = 0`. That means the same radius (`R`) and full opacity. Both formulas meet it, so no dot ever jumps in size when the level changes. (An earlier draft had the coarse radius grow linearly to `2R`, which snapped every other dot from `2R` to `R` at each octave.)

Zooming in, `t` rises: the coarse dots spread out, and the fine dots fade and grow in between them until they're indistinguishable from the coarse ones. Zooming out runs the same maths in reverse: half the dots shrink and fade out while the remaining dots move apart. That gives the behaviour B5 describes, with a useful dot size at every zoom. Tune `a`, `R` and `G` by eye.

Implementation: **start with a `<canvas>`** that fills the viewport, sized `× devicePixelRatio`, and redraw it in a `requestAnimationFrame` whenever the camera, viewport or colour mode changes. It's two nested loops of `arc()` calls (a few thousand dots at most). A canvas gives crisp small dots and exact positions. The CSS alternative (two `radial-gradient` background layers) is cheaper, but blurs small radii, drifts with fractional tile sizes, and needs a `−spacing/2` offset because the gradient dot sits at the tile centre. Dot colours come from Nuxt UI CSS variables (read through `getComputedStyle`), so they follow light and dark mode.

---

## 3. Camera and board bounds

### 3.1 Camera state and inputs

The camera lives in the board store (Section 4.5): `{ x, y, scale }`. It is **local only** and never broadcast or persisted. Each user has their own view.

| Input                                       | Behaviour                                                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Left-drag on empty board (Select tool)      | Pan (A1). Use pointer events with `setPointerCapture`, so a drag that leaves the viewport keeps working.                                       |
| Middle-drag anywhere                        | Pan, in every tool.                                                                                                                             |
| Wheel / pinch                               | Zoom around the cursor: `scale *= exp(-deltaY * k)`. Normalise `deltaMode` (lines × 16, pages × viewport height). Use a larger `k` for `ctrlKey` (pinch) events, whose deltas are small. `@wheel.prevent` with `{ passive: false }`. |
| Zoom slider (top corner)                    | A Nuxt UI `USlider` on a **logarithmic** mapping (`value = log(scale)`), zooming around the viewport centre. Optional extras: a % label, +/− buttons and a "Fit" button that reruns B4. |
| Window resize                               | Keep the world point at the view's centre in the centre (otherwise the centre drifts and new cards appear off the board's centre), recompute the minimum bounds (3.2) and re-clamp. |

Zooming around a point keeps that world point under the cursor:

```
world = screenToWorld(cursor, cam)
cam.scale = clampScale(newScale)
cam.x = world.x - cursor.x / cam.scale
cam.y = world.y - cursor.y / cam.scale
then clampCamera()
```

### 3.2 Board bounds (B1)

The bounds are recomputed whenever the cards, the camera or the viewport size change:

```
minBounds    = rect centred on (0,0) with size max(START_SIZE, viewportSize at scale 1)
               // START_SIZE ≈ 3200 × 2000 world units, a little over a 2560×1440 window
contentRect  = union(card rects) expanded by MARGIN (≈ 300 world units), or empty if no cards
targetBounds = union(minBounds, contentRect)
bounds       = union(targetBounds, viewRect)        ← the "never shrink while on screen" rule
```

**Why `union(targetBounds, viewRect)` gives the behaviour Brett described:**

- **Growing:** when a card moves into the margin, `contentRect` grows, so `bounds` grows straight away. This also happens for cards moved by other users (B1 "including … remotely"), because remote changes update the same store.
- **Shrinking while out of sight:** when the edge-defining card is deleted or moved inward, `targetBounds` shrinks. Any part of that region still on screen stays in `bounds` through `viewRect`. As soon as the camera moves away, the next recompute drops it. There is no timer and no "pending shrink" state.
- **The camera cannot use the lazy region to escape:** camera clamping (3.3) is checked against the bounds **before** the move. Moving outward into lazily-kept space can't go further than the current view already reaches, so the user meets an edge there.

Bounds are a `computed` in the store. Recomputing is O(n cards) per change, which is fine for hundreds of cards. If boards ever get large, cache `contentRect` and update it incrementally.

Also add a hard sanity cap (±100 000 world units). Enforce it with the DB `sane_geometry` check (4.2) and clamp to the same limit on the client before writing, so local and DB state can't differ.

### 3.3 Clamping

```
minScale = max(ABS_MIN_SCALE /*0.1*/, min(vpW / targetBounds.w, vpH / targetBounds.h))  // whole board fits at max zoom-out
maxScale = ABS_MAX_SCALE /*4*/
clampCamera(cam, B):            // B = bounds snapshot taken BEFORE the move
  per axis: if view length <= B length → cam ∈ [B.min, B.max - viewLength]
            else                        → centre B on that axis (camera locked on that axis)
```

- `minScale` uses the **smaller** ratio, computed from `targetBounds` (not the union, which would be circular because it contains the view). At maximum zoom-out the whole board fits. On the axis where the board is relatively shorter, the view shows plain dots beyond the bounds and the camera is centred on that axis. The dots are infinite, so no edge is ever visible. This keeps B4 working for boards whose shape differs from the window's. _(Confirmed by Brett.)_
- **Snapshot rule:** camera input handlers take `const B = bounds.value` **before** changing the camera, then clamp the proposed camera against `B`. The `bounds` computed already includes the new view afterwards, so clamping against it would do nothing.
- **Window resize:** clamp against `targetBounds`, not `bounds`. The union contains the view by definition.
- **Performance:** `contentRect` is its own computed (cards only), so panning doesn't trigger the O(n) pass. Only the cheap union depends on the camera.

### 3.4 Opening the board (B4)

After the first card fetch: if there are cards, fit `contentRect` (with margin) into the viewport, at a scale capped at 1 (A6) and clamped to `[minScale, maxScale]`, and centre it. Otherwise centre on (0, 0) at scale 1. `minScale` comes from `targetBounds`, which contains `contentRect`, so the fit is always reachable. Run this once per page load, after the viewport has a measured size (`onMounted` + `nextTick`, or the first `ResizeObserver` callback).

### 3.5 Where new cards appear

Notes and shapes are created at the **centre of the current view**, in world units (today they use `window.innerWidth/2`, which is wrong once the camera moves). If another card's top-left already sits within a few units of that point, offset diagonally so repeated clicks don't stack exactly. Draw cards get their geometry from the stroke (Section 4.4).

---

## 4. Card model

### 4.1 Shared frame, type-specific body

Every card type shares one frame component that owns everything to do with **board interaction**. Each type only supplies its **content**.

```
BaseCard.vue  (geometry, z-index, interact.js drag/resize, lock state & visuals,
               context menu shell, selection, "hold" acquire/release)
  └─ <component :is="CARD_TYPES[card.type].body" :card="card" :editable="isHolder" @content="..."/>
       NoteCardBody.vue   textarea, colours, auto-grow
       ShapeCardBody.vue  SVG shape with viewBox "0 0 100 100" + preserveAspectRatio="none"
       DrawCardBody.vue   SVG polyline(s) in card-pixel units (4.4)
```

A **card type registry** (`CARD_TYPES` in `src/cards/registry.ts`) holds, per type: the body component, default size, minimum size, default content, context-menu items, and a `parseContent(json)` guard. Adding a type means adding one body component and one registry entry.

Bodies never write to the database or the channel themselves. They emit content changes to `BaseCard` / the store, which owns the write and broadcast pipeline (Section 6). That keeps the realtime rules in one place.

### 4.2 Schema (migration on the basic-board branch)

Add a **new migration**. Never edit applied ones.

```sql
create type card_type as enum ('note', 'shape', 'draw');

alter table public.cards
  alter column x      type double precision,
  alter column y      type double precision,
  alter column width  type double precision,
  alter column height type double precision,
  add column type      card_type not null default 'note',    -- default only fills existing rows; dropped below
  add column content   jsonb    not null default '{}'::jsonb,
  add column layer     smallint not null default 1,          -- 0 Back, 1 Middle, 2 Front
  add column z_order   bigint   not null default 0,          -- last-touched order within a layer
  add column rev       bigint   not null default 0,          -- ordering of updates (Section 6.4)
  add column created_by uuid default auth.uid() references user_profiles(id) on delete set null,
  add column updated_by uuid references user_profiles(id) on delete set null,   -- set by trigger
  add constraint valid_layer    check (layer between 0 and 2),
  add constraint content_object check (jsonb_typeof(content) = 'object'),
  add constraint content_size   check (octet_length(content::text) < 100000),  -- see note on payload size
  add constraint sane_geometry  check (abs(x) < 100000 and abs(y) < 100000 and width < 100000 and height < 100000);

alter table public.cards alter column type drop default;  -- a client bug must not silently create notes
```

- The `int → double precision` changes need no `USING` clause.
- An enum is fine for three types. `text` plus a `check` constraint is the easier alternative if more types are expected (adding an enum value needs its own migration step).
- Existing RLS on `cards` (via `can_access_card_board`) already covers select, insert, update and delete for everyone with board access. No change is needed for C1.
- The `set_updated_at` trigger already exists. Add a `before insert or update` trigger that sets `updated_by = auth.uid()` (and sets `created_by` on insert), so clients can't spoof either field.
- **Payload size:** `realtime.broadcast_changes` sends both `record` and `old_record` on UPDATE, so a card's broadcast is about twice its content size. The 100 KB text cap keeps the worst case under the 256 KB broadcast limit. (Section 6.3 describes an option that avoids the doubling.)
- **Rev trigger** (`before update`), ordering stale and concurrent writes on the server:
  ```sql
  if new.rev < old.rev then return null;                    -- stale, out-of-order write: skip silently
  elsif new.rev = old.rev then new.rev := old.rev + 1;      -- equal rev (conflict window, Studio or RPC edits): accept and bump
  end if;
  return new;
  ```
  Clients write with plain `update(...).eq('id', id).select('id, rev')`. They don't use a `.lt('rev', …)` filter, so the trigger has the final say. Section 6.4 says how to interpret a 0-row result.
- Regenerate `src/types/database.types.ts` afterwards.

### 4.3 Content shapes (TypeScript, `src/types/cards.ts`)

```ts
type PaletteColor = "auto" | "yellow" | "pink" | "blue" | "green" | "purple" | "orange" | "gray" | ...; // A4

type NoteContent  = { text: string; color: PaletteColor; textColor: PaletteColor };
type ShapeContent = { shape: "square" | "triangle" | "circle"; color: PaletteColor };
type DrawContent  = { color: PaletteColor; thickness: number; strokes: Point[][] }; // normalised 0..1 (4.4)

type Card = Omit<Tables<"cards">, "content"> &
  ({ type: "note"; content: NoteContent } | { type: "shape"; content: ShapeContent } | { type: "draw"; content: DrawContent });
```

The generated `Database` type will type `content` as `Json`. Every read goes through the registry's `parseContent`, which fills in defaults for missing fields, so old rows and new fields stay compatible without migrations.

Palette colours are CSS variables, for example `--card-yellow` defined for `:root` and `.dark`, so a card's colour follows the viewer's colour mode (N3). `auto` uses neutral variables (`--ui-bg-elevated` / `--ui-text`).

### 4.4 Draw cards (D1–D4)

- **Capture:** with the Draw tool active, a pointerdown on the viewport (on top of cards too) starts a stroke. Points are collected in **world** units via `screenToWorld`. Pointer events are coalesced with `getCoalescedEvents()` for smoothness and rendered live in `DrawPreview`.
- **On release:** simplify the stroke (Ramer–Douglas–Peucker with a tolerance of about 0.5 / scale world units, capped at ~2 000 points). Then compute the stroke's bounding box, pad it by `thickness / 2` on every side so the line isn't clipped, and create the card with that rect. Points are stored **normalised to the inner box** (card rect minus the padding), as `0..1` pairs.
- **Render:** `<svg :viewBox="`0 0 ${w} ${h}`">` with a polyline whose points are `pad + p.x * (w - 2*pad)`, and so on, and `stroke-width = thickness`. Thickness is in world units, so it scales with the **camera zoom** (it's part of the board) but **not with the card's resize** (confirmed decision). Avoid `vector-effect: non-scaling-stroke`, because it would also ignore the camera zoom.
- **Changing thickness after drawing (D3):** the padding changes, so adjust `x/y/width/height` by the padding difference in the same update. That keeps the path visually in place.
- **Live ghost stroke for other users:** broadcast `stroke:preview` events with batches of new world-space points (Section 6.2), plus `stroke:end` or `stroke:cancel`. Receivers draw them in the drawer's user colour (or the chosen stroke colour) in `DrawPreview`. When the real card's INSERT arrives, the ghost for that `strokeId` is removed. The client generates the card id up front and uses it as the `strokeId`.
- **Eraser (D4, "maybe"):** `strokes: Point[][]` already allows one card to hold several polylines. Erasing hit-tests the eraser path against the segments (in world units, using the card transform). It removes the covered points and splits polylines where needed, then recomputes the bounding box and renormalises. A card with no points left is deleted. Erasing needs the card's lock (Section 7.2) like any other edit. This is deliberately last in the roadmap.

### 4.5 Client state: the board store

Create a **Pinia store per open board**, `useBoardStore` (`src/stores/board.ts`), reset when the board page unmounts. It is the single source of truth for everything the board renders:

```
boardId, board row
cards: Map<id, Card>       // or reactive record; never arrays mutated by index from children
camera: { x, y, scale }, viewport: { w, h }
derived: contentRect, bounds, minScale, sortedForZ, lockByCardId (from presence), myHolds
tool: 'select' | 'draw' | 'erase'; toolOptions: { drawColor, drawThickness }
selection: cardId | null
remote: presence list, cursors, ghost strokes
actions: createCard, updateGeometry, updateContent, deleteCard, setLayer, bringToFront,
         applyRemote(event), hold(cardId, mode), release(cardId), fitToContent, zoomAt, panBy
```

Components read from the store and call its actions. `Card.vue` today copies the prop into its own `reactive()`, which breaks the link with the parent. The new code must not do that. `BaseCard` receives a card id (or the store's reactive object) and mutates only through actions.

### 4.6 Stacking and layers

- Render order is `(layer, z_order, id)`. Apply it with **CSS `z-index`** computed from the sorted index, **not** by reordering the `v-for`. Reordering DOM nodes mid-interaction can blur a focused textarea and disturb interact.js's pointer tracking.
- "Last touched comes to front": when a hold starts, set `z_order = max(z_order of cards in the same layer) + 1`, computed from local state and sent with the first geometry or content update. If two users touch cards at the same moment and pick the same value, the tie is broken by id. That's harmless.
- The right-click menu has `Layer → Back / Middle / Front`. Changing the layer also bumps `z_order`, so the card lands on top of its new layer.

### 4.7 Delete, context menu and keyboard

- The context menu is Nuxt UI `UContextMenu`, as in the prototype. Its items come from the registry: colour, shape kind, thickness, layer, delete.
- Delete is allowed only when nobody else holds the card. The deleting client takes a brief hold, deletes, and releases. Deletes are optimistic: remove the card locally, then delete the row. If the delete fails, restore the card and show a toast.
- `Delete` / `Backspace` on a selected card that isn't in text-edit mode deletes it.

---

## 5. How cards and the board interact (summary)

| Interaction                    | Rule                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer routing                | **Don't `stopPropagation` on cards.** interact.js listens on the document, so a stopped pointerdown never starts a drag. Instead, the board's pointerdown handler starts a left-button pan only when `!e.target.closest('.board-card')`. Pointerdown on empty board pans (Select tool) or draws (Draw tool). The middle button always pans; call `preventDefault` on its `mousedown` so Windows autoscroll doesn't start. In Draw/Erase tools, cards ignore pointer events (`pointer-events: none` on the cards layer) so strokes can start over them. |
| Coordinates                    | Cards only know world units. The camera conversion happens only in `camera.ts` helpers and interact listeners (÷ scale).                                                                            |
| Bounds                         | Any geometry change, local or remote, re-derives `contentRect`, then `bounds`, then `minScale`. The camera is re-clamped **only on camera input or viewport resize**, never because a card moved. Remote activity never moves your camera. |
| Creation                       | At the view centre (3.5), or from the stroke (4.4).                                                                                                                                                 |
| Zoom during an interaction     | Blocked while a card is being dragged or resized (2.3), because interact's start rect is in screen pixels. Interact listeners still read the current scale on every event.                                                                                                                                 |
| Selection                      | A single selected card id in the store, used for the focus outline, keyboard delete and the context menu. Selection is local and not broadcast (locks are what others see).                         |

---

## 6. Realtime architecture

### 6.1 One private channel per board

All board collaboration runs over **one channel per board: `board:<board_id>`, created with `config: { private: true }`**. It carries:

- **Broadcast (client → client)**: ephemeral events (6.2).
- **Broadcast (database → client)**: authoritative row changes from a trigger (6.3).
- **Presence**: who is here, their colour, and what they hold (Section 7).

Current problems this fixes: `Card.vue` and `Cards.vue` use one global `"board-broadcast"` channel, so every board's updates reach every client, with no access control. `Cards.vue` selects **all** cards without filtering by board and still uses `card_id`, which a later migration renamed to `id`. `Card.vue` creates a channel **per card**.

**Authorization:** Supabase Realtime Authorization uses RLS on `realtime.messages`. Add a migration with:

```sql
-- Topic format: 'board:<uuid>'. Returns false (not an error) for malformed topics.
create or replace function public.can_access_board_topic(topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if topic !~ '^board:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.can_select_board(substring(topic from 7)::uuid, (select auth.uid()));
end; $$;

create policy "Board members can receive board broadcasts and presence"
  on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
         and public.can_access_board_topic((select realtime.topic())));

create policy "Board members can send board broadcasts and presence"
  on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence')
              and public.can_access_board_topic((select realtime.topic())));
```

Notes:

- Do **not** put `alter table realtime.messages enable row level security` in a migration. It is already enabled, and the statement fails with an owner error that aborts the migration.
- Private channels work while "Allow public access" is still enabled, so the existing public `user:<id>` channels keep working. Making those private too is a separate hardening task (10.2).
- Call `await supabase.realtime.setAuth()` before subscribing, so the socket carries the user's JWT.
- Access is checked **when joining** and cached for the connection. Losing access to a shared board takes effect on the socket only at the next token refresh. Database writes are blocked by RLS straight away (6.6).

**Who owns the channel:** a board composable/module (`src/realtime/boardChannel.ts`, used by the board store) creates the channel, registers all handlers **before** `subscribe()`, and removes it on unmount. It does not go through `useRealtimeStore`. That store is built around long-lived per-user topics and wildcard broadcast handlers, and has no presence support. Keep `REALTIME.TOPICS.BOARD = "board:"` and the event names in `constants.ts`.

### 6.2 Ephemeral events (client broadcast)

| Event            | Payload                                                                     | Sent when / rate                                                           |
| ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `card:geometry`  | `{ id, x, y, width, height, layer, z_order, rev, by }`                      | While dragging or resizing, throttled to **50 ms**, plus a final send on release. |
| `card:content`   | `{ id, content (full object), rev, by }`                                    | While typing or changing options, throttled to **100 ms**, plus a final send. |
| `card:create`    | the full card row                                                           | Immediately after a local create (before the insert returns).             |
| `card:delete`    | `{ id, by }`                                                                | Immediately on a local delete.                                             |
| `cursor`         | `{ x, y }` (world), plus `clientId`                                          | On pointer move, throttled to **100 ms**. Not sent while a `card:geometry` stream is running (receivers infer the cursor from the drag). |
| `stroke:preview` | `{ strokeId, color, thickness, points: Point[] (new since last send) }`     | While drawing, throttled to **50 ms**.                                     |
| `stroke:end` / `stroke:cancel` | `{ strokeId }`                                                | On release or cancel.                                                      |

- Use `broadcast: { self: false }` (the default). The sender has already applied its change locally.
- `card:create` and `card:delete` are sent by the client **and** arrive later from the database (6.3). Receivers deduplicate by id, so whichever arrives first wins and the second does nothing. If the insert fails after `card:create` was broadcast, the creator broadcasts `card:delete` and removes the card locally, so other clients don't keep a phantom card.
- **Message budget.** The free tier allows roughly 100 messages per second for the project, and going over **disconnects clients**. Delivering one broadcast to N−1 receivers probably counts N−1 times. One user dragging at 20 Hz to 3 others is ~60 msg/s. Keep every rate in one `REALTIME.RATES` constant so they can be tuned, and receivers should **interpolate** (lerp toward the latest target on `requestAnimationFrame`) so lower send rates still look smooth. If limits become a problem, the first levers are cursors at 150 ms and geometry at 80 ms.

### 6.3 Authoritative events (database broadcast)

Add an `after insert or update or delete` trigger on `public.cards` that calls

```sql
perform realtime.broadcast_changes('board:' || coalesce(new.board_id, old.board_id)::text,
                                   tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
```

It runs as `security definer`, with `set search_path = ''`. Clients listen for the `INSERT`, `UPDATE` and `DELETE` broadcast events on the same private channel.

Why add this when clients already broadcast:

- It makes the **database the source of truth**, replacing the "debounced 400 ms re-read of every card" in `Cards.vue`. Each committed row change is pushed once, scoped to its board.
- It catches changes that no client broadcasts, such as rows removed by a cascade when a board is deleted, or edits made in Studio.
- Receivers apply it using the same rev rule as ephemeral events (6.4), so a late DB event never moves a card backwards.

To keep DB-driven traffic down, persist geometry at **~500 ms** during an interaction (crash safety) plus once on release, instead of today's 200 ms. Note text is persisted after a **~600 ms** debounce, plus on blur or release.

> Spike first: check `broadcast_changes` and private channels against the **local** stack (`supabase start`) and the version CI uses.
>
> - The docs say the `realtime.messages` partition is created when a client connects. **A broadcast failure must never fail the card write**, so if `broadcast_changes` can raise, wrap the call in `begin … exception when others then raise warning …; end`.
> - Consider a custom trigger that calls `realtime.send(jsonb_build_object('record', to_jsonb(new)), tg_op, topic, true)` with only the new row (or `{ id }` for DELETE). That halves the payload compared with `broadcast_changes`, which also sends `old_record`.
> - If the trigger approach misbehaves locally, the fallback is Postgres Changes (`postgres_changes` filtered by `board_id=eq.<id>`, which respects RLS), with the same rev rule.

### 6.4 Ordering and consistency: `rev`

Each card has `rev`. **Only the current holder** changes a card, and every change it makes, whether broadcast or written, carries `rev = previous + 1`.

A receiver applies an incoming card state (ephemeral or database) only if:

1. `incoming.rev > local.rev`, **and**
2. it is not the holder of that card itself. A holder ignores remote state for the card it is holding. If someone else really has the card, the lock conflict rule (7.2) settles it.

On the database side, the rev trigger (4.2) skips writes with a lower rev and accepts and bumps writes with an equal rev. Out-of-order throttled sends, late DB echoes and reconnect refetches are all handled by these comparisons. The global debounced re-read and its field-by-field copy go away.

**Interpreting write results:**

- **The write returns a row:** adopt the returned `rev` as the local rev, if it's higher than the local one (the trigger may have bumped it).
- **The write returns 0 rows:** this is **not** necessarily lost access. Re-select the row.
  - If the row exists and `db.rev` ≥ the rev just sent, a newer write already landed. Rebase: set the local rev to `db.rev`, and if this client is still the holder, resend its current state with `db.rev + 1`.
  - Only if the row **doesn't come back** (deleted, or RLS now hides it) should the client treat it as deleted or access lost (6.6).

**Release ordering:** on release, **await** the final DB write, adopt its returned rev, send the final `card:*` broadcast with that rev, and only then `track({ hold: null })`. A new holder therefore starts from a rev at least as high as the database's. Broadcasts are not guaranteed to arrive, so the awaited write is what makes this safe. The DB `UPDATE` echo (6.3) covers anyone who missed the final broadcast.

### 6.5 Joining, reconnecting and leaving

- **Join:** fetch the board row and its cards (`select … where board_id = :id`), subscribe to the channel, then **refetch the cards once `SUBSCRIBED`**. Merge by rev, so anything that changed between the first fetch and the subscription isn't lost. Then `track()` presence.
- **Reconnect:** supabase-js rejoins on its own. On every transition back to `SUBSCRIBED`, refetch the cards (merge by rev). If this client was holding a card, **don't assume it still holds it**: its presence probably expired while it was away. Read the presence state first. If someone else now holds the card, drop the local hold and adopt the refetched state. Otherwise re-`track()` the hold and resume. While disconnected, show the card as "reconnecting", and buffer the latest state rather than sending writes.
- **Leave:** on route leave (`onBeforeRouteLeave` / `onUnmounted`), release holds (await the final writes), `untrack()`, and `removeChannel`. Async writes during `pagehide` or tab close aren't reliable, so don't depend on them. Presence leave events handle the cleanup for abrupt closes (7.4). Only the last throttled frame (≤ 500 ms of motion) can be lost.

### 6.6 Losing access mid-session

- If the board is deleted, the DB broadcast stream delivers `DELETE`s for every card. Also listen for board deletion: either add the same trigger to `boards`, or check the board row on channel errors. Navigate to the dashboard with a toast.
- An unshared user's updates silently affect **0 rows** under RLS (no error). A 0-row write is first re-checked as described in 6.4. Only if the re-select also returns nothing, **and** a `boards` select for this board is empty, treat it as "access lost", then do the same as above.

---

## 7. Presence, locks, cursors and indicators (C2–C4)

### 7.1 Presence payload

```ts
// presence key = clientId (crypto.randomUUID() per tab), so one user in two tabs is two clients
type BoardPresence = {
  clientId: string;
  userId: string;
  username: string;
  color: string;                 // from userColor(userId), A8
  joinedAt: number;
  hold: { cardId: string; mode: "move" | "resize" | "edit" | "erase"; at: number } | null;
};
```

Presence is for **slow-changing state only**. It changes on join, leave, hold and release. Cursors never go in presence, because presence notifies every subscriber on every change and has a lower rate limit than broadcast.

C2 indicators (the top corner) come from `presenceState()`, **grouped by `userId`**, excluding yourself or marking yourself as "you": an avatar or initials chip in the user's colour, and a count if there are many.

### 7.2 Locks (C3)

Locks are **derived from presence**: `lockByCardId = the hold with the smallest (at, clientId) among presences holding that card`.

**Acquiring** (in `BaseCard`, on interact's `start` / textarea focus):

1. If `lockByCardId[card]` belongs to another client, refuse. Cancel the interaction (`event.interaction.stop()`), or blur the textarea. The lock visual is already showing.
2. Otherwise `track({ ...me, hold: { cardId, mode, at: Date.now() } })`, bump `z_order`, and start sending immediately. This is optimistic: don't wait for the presence round trip, so grabbing feels instant.

**Conflicts:** two clients may grab the same card within the presence latency window. On every presence `sync`, each client re-derives the locks. The deterministic rule only applies between holds whose **contest window overlaps**:

- A client may contest a card only if it saw the card as **free** when it grabbed it (step 1 above).
- An established hold (one other clients have already seen in a `sync`) is never displaced by a newer hold with a smaller `at`, for example from a client with a slow clock or one that just reconnected. In practice, each client keeps `firstSeenHolder[cardId]`, and a new competing hold only wins if its `at` is smaller **and** the card was free when that hold was taken.

A client that is holding a card and **is not the winner** must:

1. stop the interaction or blur the textarea,
2. revert the card to the latest remote state it has (the winner's broadcasts are now applied, because it's no longer the holder),
3. drop its hold (`track({ hold: null })`) and **not** write anything further.

Because the winner is chosen deterministically, every client agrees without any coordination. The loser may already have sent a frame or two, and the rev rule plus the winner's next updates overwrite them. Clock skew between clients only affects which of two near-simultaneous grabs wins, which is acceptable.

**Releasing:** pointerup (drag or resize end), textarea blur, 10 s with no typing (confirmed decision), `Escape`, route leave, or losing a conflict. **Order matters** (6.4): await the final DB write, send the final broadcast, and only then `track({ hold: null })`.

**Idle release while still focused (confirmed):** when the 10 s idle timer fires, the lock is released but the textarea **stays focused**. On the next keydown, the client re-checks the lock. If the card is free, it re-acquires the hold (bumping `z_order` as usual) and lets the key through. If someone else took the card in the meantime, it calls `preventDefault()` on the key, blurs the textarea, and the card shows as locked by that user. Until the lock is re-taken, the textarea's text is treated like remote-owned state, so incoming updates from the new holder are applied.

**Click without a drag:** interact's `start` only fires after the pointer moves, so a plain click on a card would never bring it to front. Bring-to-front (the `z_order` bump) therefore runs on card **pointerdown**, and only if the card is free. It's sent as a tiny one-off update (a brief hold), even when no drag follows.

**One hold per client.** Grabbing another card releases the first. That keeps presence simple and matches how a single pointer works.

**Basic-collaboration branch scope:** presence holds and the conflict rule are implemented on that branch, without the visible UI. Holds are what stop two clients overwriting each other's drags, and the rev rule depends on a single writer. The later Collaboration branch adds visuals, refusal feedback and cursors on top without changing the data flow.

### 7.3 Cursors (C4)

- Broadcast `cursor` in **world** units (6.2), so the cursor points at the same thing whatever each viewer's zoom.
- Receivers keep `cursors: Map<clientId, { x, y, target, lastSeen }>`, interpolate toward the target on `requestAnimationFrame`, convert with `worldToScreen`, and render in a screen-space overlay. The cursor stays a constant size whatever the zoom, and shows a name label in the user's colour.
- Hide a cursor after ~5 s without updates, or when its client leaves presence. Cursors outside the view are simply not shown (an edge indicator is a possible later extra).
- Send nothing when the pointer leaves the viewport, and send a `cursor` with `null` once, so others hide it right away.

### 7.4 Lock visuals (C3, C4)

A card held by someone else renders with a border in the holder's colour and a small name tag (for example "Sam is editing"). It has `pointer-events: none` for interactions, but stays hoverable for the tag. The holder's cursor is shown next to it. Your own held card shows the normal focus or selection styling.

**Abrupt disconnects:** the holder's presence disappears when the server notices the socket is gone (heartbeat timeout, roughly 30 s at worst). Then the lock disappears. The card's state is whatever was last written or broadcast. That's acceptable; there is no need for a database lock reaper.

### 7.5 How the collaborative features depend on each other (summary)

```
             ┌──────────── Presence (who, colour, hold) ────────────┐
             │                    │                                 │
     C2 indicators          locks (derived)                   user colour
                                  │  gates                          │
          ┌───────────────────────┼──────────────────┐              │
     card:geometry / content   DB writes (rev)    delete            │
          │ (ephemeral)           │                                 │
          └──────────┬────────────┘                                 │
            receivers apply by rev ──► board store ──► bounds/render
                     │                                              │
                 cursors (broadcast, world units) ◄──── colour ─────┘
                 ghost strokes (broadcast)       ◄──── colour
```

- **Presence is the hub.** Identity and colour feed indicators, lock visuals, cursors and ghost strokes, so a user's colour matches everywhere (C4).
- **Locks gate all writers.** Only the holder sends `card:*` events or writes rows for that card.
- **Broadcast carries motion; the database carries truth.** Both feed one apply function guarded by `rev`.
- Cursors and ghost strokes are purely visual. They never change card state.

---

## 8. How collaboration interacts with board state (summary)

| Situation                                           | Behaviour                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote card moves outward                           | The store updates, `contentRect` grows and `bounds` grows straight away (B1 remote). The camera doesn't move.                                                                                                                                                                                    |
| Remote card moves inward or is deleted while I'm looking at that edge | `bounds = union(target, viewRect)` keeps the visible area. It shrinks once I pan or zoom away.                                                                                                                                                                                  |
| Remote card moves inward and I'm not looking         | The edge shrinks on the next recompute, out of sight.                                                                                                                                                                                                                                           |
| I'm zoomed out to `minScale` and a remote card shrinks the bounds | `minScale` rises. Clamping happens only on my next camera input, so my view doesn't jump. Zoom-out input is then limited to the new `minScale`. Because `bounds` includes my view, I never see past an edge.                                                                    |
| Remote card created                                  | Added to the store (deduplicated by id), bounds update, and it gets z-index from its `(layer, z_order)`. There's no camera jump and no auto-fit after the initial open.                                                                                                                          |
| Remote card deleted that I'm holding                 | Can't happen while I hold it: deleting requires the lock. If it does (a race or a Studio edit), the DB `DELETE` wins. Drop the hold and abort the interaction.                                                                                                                                   |
| Remote z change                                      | Re-sort and update z-index. No DOM reorder.                                                                                                                                                                                                                                                     |
| Remote zoom or pan                                   | Never shared. Cameras are per user.                                                                                                                                                                                                                                                             |
| Colour mode differs between users                    | Cards store palette names, and each viewer resolves them for their own mode (N3).                                                                                                                                                                                                               |
| Remote text while I'm reading the note               | Applied live by rev. If I double-click to edit it, the lock check refuses until the holder releases.                                                                                                                                                                                            |
| Reconnect after a gap                                 | Refetch the cards and merge by rev, then re-track presence. Holds and ghost strokes from before the gap are rebuilt from presence and new events.                                                                                                                                              |

---

## 9. Roadmap by branch

### 9.1 `basic-board` (current branch, follows the Branch Plan)

1. **Basic card**
   - Migration 4.2 (card columns, `double precision`, type/content/layer/z_order/rev). Regenerate the types.
   - `useBoardStore` skeleton: load cards **for this board only**, plus the create action.
   - `DigitalBoard.vue` becomes the viewport/world structure (2.1). `BaseCard.vue` handles drag and resize, dividing by scale (2.3). The toolbar's Note button creates a basic card at the view centre.
   - Remove the unused `Cards.vue` / `Card.vue` once they're replaced (they aren't mounted anywhere today).
2. **Board** (B1–B5)
   - `camera.ts` helpers, pan (A1), wheel zoom (1.1 "Wheel"), zoom slider, bounds and clamping (3.2–3.3), initial fit (3.4), dot grid (2.4).
3. **Note card** (N1–N3)
   - `NoteCardBody`, the palette (A4/A5) with dark-mode variables, the context menu (colour, text colour, layer, delete), double-click to edit (A3), auto-grow (A9), layers and last-touched z (4.6), keyboard delete.
4. **Basic collaboration**
   - The realtime migration (6.1 policies, 6.3 trigger). Spike 6.3 first.
   - Private `board:<id>` channel, ephemeral events for geometry, content, create and delete (6.2), the rev rule (6.4), join and reconnect (6.5).
   - Presence with `hold` and the conflict rule (7.1–7.2), **without lock visuals**. Include the "card is busy" guard, so a second user's drag is refused (confirmed).
   - Leave out: presence indicators, cursors, lock visuals and ghost strokes.
   - **As built:**
     - The spike passed against the local stack (realtime v2.66.2). Private channels, presence, client broadcasts and trigger events all work, so the Postgres Changes fallback isn't needed.
     - The card trigger uses `realtime.send` with only the new row (or `{ id }` for deletes), the smaller option from 6.3.
     - Two extra triggers send `BOARD_DELETED` (board deleted) and `ACCESS_REVOKED` (a `shared_boards` row deleted, with the user's id) to the board's channel. Clients leave the board on either, instead of only finding out from a 0-row write (6.6).
     - Every local change bumps the card's `rev`, and writes and broadcasts carry the current `rev`.
     - Deleting a card and the right-click menu's one-off changes (colour, size, layer, bring-to-front) are refused while another client holds the card, rather than taking a brief hold of their own.
     - Not done yet: receivers don't interpolate between geometry broadcasts (6.2), and there's no "reconnecting" state on cards (6.5). Both are visual, so they fit the Collaboration branch.
5. **Tests** (Section 9.5).

### 9.2 Shapes branch (S1–S3)

`ShapeCardBody` (SVG `viewBox="0 0 100 100"`, `preserveAspectRatio="none"`, ellipse / polygon / rect filling the box). Toolbar Shape button. Context menu for shape kind and colour. Nothing new in the realtime layer: shapes use the same `card:geometry` and `card:content` events.

### 9.3 Draw branch (D1–D3)

The tool state in the store (`select | draw`), toolbar toggle and toolbar options (colour and thickness before drawing), capture, simplify and normalise (4.4), `DrawCardBody`, and changing colour and thickness after drawing via the context menu. Ghost strokes may come here or in the collaboration branch. The events are already defined (6.2).

### 9.4 Collaboration branch (C2–C4) and the eraser (D4)

Presence bar (C2), lock visuals and refusal feedback (7.4), cursors (7.3), ghost strokes if not done earlier, user colours (A8). Then the eraser (4.4), if it's still wanted.

C1 (sharing with friends) **already exists** through `shared_boards` and the Share modal on the dashboard. Board features only need to rely on `can_select_board`, which the realtime policies above already do.

### 9.5 Testing approach (Playwright)

- **Selectors:** keep the existing marker-class convention and add `board-viewport`, `board-card`, `note-card`, `shape-card`, `draw-card`, `zoom-slider`, `toolbar-note-button`, and so on. Put a `data-card-id` attribute on each card so tests can follow a specific card.
- **Geometry assertions:** compare `boundingBox()` before and after with tolerances, rather than exact transforms. Drag with `page.mouse.down/move/up` using `steps`.
- **Zoom:** `page.mouse.wheel(0, ±N)` over a point, then check that the card's on-screen size changed and that the point under the cursor stayed put.
- **Bounds:** pan or zoom against an edge and check the view stops. Move a card outward and check that you can now pan further. Check the out-of-sight shrink.
- **Persistence:** reload and expect the same positions, text and colours.
- **Collaboration:** two `browser.newContext()`s with two users (one shares the board with the other, using the existing `utils.ts` helpers). Use `expect.poll` or `toHaveText` with timeouts for remote effects: move, resize, typing, create and delete. Lock test (when visuals exist): A holds, B's drag is refused.
- Add shared helpers to `e2e/utils.ts`: `openBoard`, `createNote`, `dragCard`, `cardBox`, `shareBoardWith`.
- Don't expose internals globally for tests unless a test truly can't observe something through the DOM. If that's needed, put it behind `import.meta.env.DEV`.

---

## 10. Risks, cleanup and later work

### 10.1 Risks

| Risk                                                      | Mitigation                                                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Realtime free-tier rate limit (~100 msg/s, disconnects when exceeded) | Throttled rates in one constant, interpolation, no cursor while dragging, DB writes at ~500 ms. Watch Realtime logs once there are several users.            |
| `broadcast_changes` or private channels behaving differently locally vs hosted | Spike at the start of basic collaboration. The Postgres Changes fallback is described in 6.3.                                                            |
| interact.js and a scaled parent                           | Divide by scale everywhere (2.3). Cover it with a zoomed drag test.                                                                                                        |
| Presence timing gaps (simultaneous grabs)                 | The deterministic winner rule, plus the loser reverting (7.2).                                                                                                              |
| Large draw cards near the 256 KB message limit            | Simplification and a point cap (4.4), and the `content_size` check (4.2).                                                                                                  |
| Textarea focus lost on re-render                          | Never reorder the `v-for`. Use z-index. Never replace a card object the holder is editing (the holder ignores remote state for its held card).                              |

### 10.2 Existing code that needs attention (outside the board work unless noted)

- `src/components/Cards.vue`, `Card.vue`: global channel, no board filter, stale `card_id`, copies props into local `reactive`. **Replace them on basic-board.**
- `src/router/index.ts` `checkBoardAccess`: takes the id with `to.fullPath.substring(to.fullPath.length, 7)`, which breaks if a query or hash is ever added. Use `to.params.id`. (Small and low risk. Fix it when touching the board route.)
- `user:<id>` realtime topics are public channels, so any client can send fake friend-request broadcasts to anyone (only toasts, but still). A later hardening task: make them private, with a `realtime.messages` policy of `topic = 'user:' || auth.uid()` for select, and a sender-side check.
- ~~`card` writes send the whole row.~~ Done: `persistCard` sends every user-editable field (geometry, content, layer, z_order) plus `rev`, never `created_at` and the like. It deliberately sends all editable fields rather than only the changed ones. With per-field writes, a stale write that the rev trigger skips would lose its field, if a newer write to a *different* field had overtaken it.

### 10.3 Possible later improvements (not in Requirements)

Multi-select and group move, undo/redo (it would sit on top of the store actions and needs the lock rules), off-screen cursor indicators, keyboard zoom shortcuts, a "follow user" view, a free colour picker, and touch support (pointer events are used throughout, so this is mostly about gesture handling).

---

## 11. References

- Supabase Realtime Authorization (private channels, `realtime.messages` RLS, `realtime.topic()`): https://supabase.com/docs/guides/realtime/authorization
- Supabase Broadcast (`self`, `ack`, `private`, `realtime.broadcast_changes`, `realtime.send`): https://supabase.com/docs/guides/realtime/broadcast
- Supabase Presence (`track`, `presenceState`, sync/join/leave, use broadcast for cursors): https://supabase.com/docs/guides/realtime/presence
- Supabase Realtime limits (free tier: 200 connections, 100 msg/s, 20 presence msg/s, 256 KB payload): https://supabase.com/docs/guides/realtime/limits
- interact.js dragging inside scaled elements (divide deltas by scale): https://lightrun.com/answers/taye-interact-js-dragging-in-scaled-elements
- Prototype (DOM-measured bounds and `growthPan`, which this plan replaces): https://github.com/BrettLoewen/Board-Board-Prototype
