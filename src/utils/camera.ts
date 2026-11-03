// A point in either world units (the board's coordinate space) or screen pixels (relative to the board viewport)
export type Point = { x: number; y: number };

// The world point shown at the viewport's top-left corner, and the zoom
export type Camera = { x: number; y: number; scale: number };

// A rectangle, by its top-left corner and size
export type Rect = { x: number; y: number; w: number; h: number };

// The size of the board viewport element in screen pixels
export type Viewport = { w: number; h: number };

// Convert a point in the viewport (screen pixels) to a point on the board (world units)
export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: cam.x + p.x / cam.scale, y: cam.y + p.y / cam.scale };
}

// Convert a point on the board (world units) to a point in the viewport (screen pixels)
export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale };
}

// The world rectangle the camera can currently see
export function viewRect(cam: Camera, vp: Viewport): Rect {
  return { x: cam.x, y: cam.y, w: vp.w / cam.scale, h: vp.h / cam.scale };
}

// The smallest rectangle containing both rectangles
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

// Grow a rectangle by the given amount on every side
export function expandRect(r: Rect, amount: number): Rect {
  return { x: r.x - amount, y: r.y - amount, w: r.w + amount * 2, h: r.h + amount * 2 };
}

// Keep a value inside a range
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Keep the camera's view inside the given bounds, one axis at a time.
// If the view is longer than the bounds on an axis, the bounds are centred on that axis instead.
export function clampCamera(cam: Camera, bounds: Rect, vp: Viewport): Camera {
  const view = viewRect(cam, vp);

  const clampAxis = (pos: number, viewLength: number, min: number, length: number) =>
    viewLength <= length
      ? clamp(pos, min, min + length - viewLength)
      : min + length / 2 - viewLength / 2;

  return {
    x: clampAxis(cam.x, view.w, bounds.x, bounds.w),
    y: clampAxis(cam.y, view.h, bounds.y, bounds.h),
    scale: cam.scale,
  };
}

// Change the zoom while keeping the world point under the given screen point in the same place
export function zoomAround(cam: Camera, screenPoint: Point, scale: number): Camera {
  const world = screenToWorld(screenPoint, cam);
  return {
    x: world.x - screenPoint.x / scale,
    y: world.y - screenPoint.y / scale,
    scale,
  };
}
