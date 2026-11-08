import type { ContextMenuItem } from "@nuxt/ui";
import type { Json } from "@/types/database.types";
import type { DrawContent, DrawDefaults, StrokePoint } from "@/types/cards";
import type { Card, BoardStore } from "@/stores/board";
import type { Point } from "@/utils/camera";
import { DRAW } from "@/constants";
import { isCardColor, strokeColor } from "@/utils/colors";
import { colorMenuItems } from "./colorMenu";
import { asObject } from "./content";
import { isSizeInRange, sizeMenuItems, type SizeOptions } from "./sizeMenu";

// The options a drawing starts with before the user has picked any
export const DRAW_DEFAULTS: DrawDefaults = { color: "green", thickness: 4 };

// The line thicknesses offered in the menu (in world units, so lines scale with the zoom),
// and the range a typed thickness is kept inside
export const THICKNESS: SizeOptions = {
  presets: [1, 2, 4, 6, 8, 12, 16, 24],
  range: { min: 1, max: 64 },
  label: "Thickness",
  name: "Line thickness",
};

//============ Reading content ============
// Whether a value is a list of [x, y] points
function isStroke(value: unknown): value is StrokePoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((n) => typeof n === "number" && Number.isFinite(n)),
    )
  );
}

// Read a drawing's options (from its content, or from the user's saved defaults),
// falling back to the built-in defaults for anything missing or invalid
export function parseDrawDefaults(value: Json | undefined): DrawDefaults {
  const saved = asObject(value);
  return {
    color: isCardColor(saved.color) ? saved.color : DRAW_DEFAULTS.color,
    thickness: isSizeInRange(saved.thickness, THICKNESS.range)
      ? saved.thickness
      : DRAW_DEFAULTS.thickness,
  };
}

// Read a drawing's content from the database, filling in defaults for anything missing or invalid
export function parseDrawContent(content: Json | undefined): DrawContent {
  const value = asObject(content);
  const strokes = Array.isArray(value.strokes) ? value.strokes.filter(isStroke) : [];
  return { ...parseDrawDefaults(content), strokes };
}

//============ Geometry ============
// The space between a drawing's card edge and its drawing area: half the line (so it isn't cut off),
// plus room to grab and resize the card
export function drawPadding(thickness: number): number {
  return thickness / 2 + DRAW.PADDING;
}

// How far a point is from the line through a and b (or from a, if a and b are the same point)
function distanceToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
}

// Ramer–Douglas–Peucker: drop the points that stray less than `tolerance` from the line between their neighbours.
// Keeps the first and last points. Written with a stack instead of recursion, so long lines can't overflow it.
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop()!;
    let furthest = -1;
    let furthestDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToLine(points[i]!, points[start]!, points[end]!);
      if (distance > furthestDistance) {
        furthest = i;
        furthestDistance = distance;
      }
    }
    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([start, furthest], [furthest, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// Simplify a finished line, loosening the tolerance until it fits inside the point limit
function simplifyToLimit(points: Point[], tolerance: number): Point[] {
  let simplified = simplify(points, tolerance);
  while (simplified.length > DRAW.MAX_POINTS) {
    tolerance *= 2;
    simplified = simplify(simplified, tolerance);
  }
  return simplified;
}

// Turn a finished line (in world units) into a draw card's rect and content.
// The card is the line's bounding box plus padding, and the points are stored as fractions of the box,
// so the line stretches with the card when it is resized. `scale` is the zoom the line was drawn at.
export function drawCardFromStroke(
  points: Point[],
  options: DrawDefaults & { scale: number },
): { rect: { x: number; y: number; width: number; height: number }; content: DrawContent } {
  const simplified = simplifyToLimit(points, DRAW.SIMPLIFY_TOLERANCE / options.scale);

  const xs = simplified.map((p) => p.x);
  const ys = simplified.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;

  // A line with no width (or no height) sits in the middle of that direction
  const precision = 10 ** DRAW.POINT_PRECISION;
  const fraction = (value: number, min: number, size: number) =>
    size > 0 ? Math.round(((value - min) / size) * precision) / precision : 0.5;
  const stroke: StrokePoint[] = simplified.map((p) => [
    fraction(p.x, minX, width),
    fraction(p.y, minY, height),
  ]);
  // A single click draws a dot: a line from the point to itself, drawn with round ends
  if (stroke.length === 1) stroke.push([...stroke[0]!]);

  const pad = drawPadding(options.thickness);
  return {
    rect: { x: minX - pad, y: minY - pad, width: width + pad * 2, height: height + pad * 2 },
    content: { color: options.color, thickness: options.thickness, strokes: [stroke] },
  };
}

// The SVG points of a stroke inside a card of the given size (in world units)
export function strokeToSvg(
  stroke: StrokePoint[],
  size: { width: number; height: number },
  thickness: number,
): string {
  const pad = drawPadding(thickness);
  const innerWidth = Math.max(0, size.width - pad * 2);
  const innerHeight = Math.max(0, size.height - pad * 2);
  return stroke.map(([x, y]) => `${pad + x * innerWidth},${pad + y * innerHeight}`).join(" ");
}

// The SVG points of a line in world units (a line being drawn)
export function pointsToSvg(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

//============ Menus ============
// Change a drawing's line thickness, keeping the line where it is on the board.
// The padding around the line depends on the thickness, so the card grows or shrinks around the line by the
// difference. The new size is shared before the new thickness, so other clients apply both (each has a newer rev).
function changeThickness(card: Card, board: BoardStore, thickness: number): void {
  if (board.isHeldByOther(card.id)) return;
  const change = drawPadding(thickness) - drawPadding(parseDrawContent(card.content).thickness);
  if (change !== 0) {
    board.updateGeometry(card.id, {
      x: card.x - change,
      y: card.y - change,
      width: card.width + change * 2,
      height: card.height + change * 2,
    });
    board.broadcastGeometry(card.id);
  }
  board.changeContent(card.id, { thickness });
}

// The submenus for a line's colour and thickness, used by draw cards and by the toolbar's Draw button
export function drawOptionMenuItems(options: {
  labels: { color: string; thickness: string; customTitle: string };
  current: DrawDefaults;
  board: BoardStore;
  onPick: (patch: Partial<DrawDefaults>) => void;
}): ContextMenuItem[] {
  const { labels, current, board, onPick } = options;

  return [
    {
      label: labels.color,
      icon: "i-ph-palette",
      children: colorMenuItems({
        current: current.color,
        swatch: strokeColor,
        onPick: (color) => onPick({ color }),
        onCustom: () =>
          board.requestCustomColor({
            title: labels.customTitle,
            color: current.color,
            apply: (color) => onPick({ color }),
          }),
      }),
    },
    {
      label: labels.thickness,
      icon: "i-ph-line-segment",
      children: sizeMenuItems({
        ...THICKNESS,
        current: current.thickness,
        onPick: (thickness) => onPick({ thickness }),
      }),
    },
  ];
}

// The draw-specific items of a drawing's right-click menu: its line's colour and thickness.
// Picking an option also makes it the default for the user's next drawing.
export function drawMenuItems(card: Card, board: BoardStore): ContextMenuItem[] {
  return drawOptionMenuItems({
    labels: { color: "Colour", thickness: "Thickness", customTitle: "Line colour" },
    current: parseDrawContent(card.content),
    board,
    onPick: (patch) => {
      if (patch.thickness !== undefined) changeThickness(card, board, patch.thickness);
      if (patch.color !== undefined) board.changeContent(card.id, { color: patch.color });
      board.setDrawDefaults(patch);
    },
  });
}
