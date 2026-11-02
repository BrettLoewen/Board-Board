// A point in either world units (the board's coordinate space) or screen pixels (relative to the board viewport)
export type Point = { x: number; y: number };

// The world point shown at the viewport's top-left corner, and the zoom
export type Camera = { x: number; y: number; scale: number };

// Convert a point in the viewport (screen pixels) to a point on the board (world units)
export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: cam.x + p.x / cam.scale, y: cam.y + p.y / cam.scale };
}

// Convert a point on the board (world units) to a point in the viewport (screen pixels)
export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale };
}
