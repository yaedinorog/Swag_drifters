import type { Vector2 } from "../physics/types.js";

function orientation(a: Vector2, b: Vector2, c: Vector2): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: Vector2, b: Vector2, c: Vector2): boolean {
  return (
    Math.min(a.x, c.x) - 1e-6 <= b.x &&
    b.x <= Math.max(a.x, c.x) + 1e-6 &&
    Math.min(a.y, c.y) - 1e-6 <= b.y &&
    b.y <= Math.max(a.y, c.y) + 1e-6
  );
}

export function segmentsIntersect(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (Math.abs(o1) < 1e-6 && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) < 1e-6 && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) < 1e-6 && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) < 1e-6 && onSegment(b1, a2, b2)) return true;
  return false;
}
