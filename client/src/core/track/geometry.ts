import type { Vector2 } from "../types";
import type { Quad, TrackAssetV1, TrackGeometry } from "./types";

function normalize(x: number, y: number): Vector2 {
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

function almostEqual(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
}

function getClosedCenterline(points: Vector2[]): Vector2[] {
  if (points.length < 3) {
    throw new Error("Track centerline must contain at least 3 points.");
  }
  const clean = [...points];
  if (almostEqual(clean[0], clean[clean.length - 1])) {
    clean.pop();
  }
  return clean;
}

function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function distancePow(a: Vector2, b: Vector2): number {
  return Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5);
}

function lerpPoint(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function catmullRomCentripetal(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number): Vector2 {
  const t0 = 0;
  const t1 = t0 + Math.max(1e-4, distancePow(p0, p1));
  const t2 = t1 + Math.max(1e-4, distancePow(p1, p2));
  const t3 = t2 + Math.max(1e-4, distancePow(p2, p3));
  const tt = t1 + (t2 - t1) * t;

  const a1 = lerpPoint(p0, p1, (tt - t0) / (t1 - t0));
  const a2 = lerpPoint(p1, p2, (tt - t1) / (t2 - t1));
  const a3 = lerpPoint(p2, p3, (tt - t2) / (t3 - t2));
  const b1 = lerpPoint(a1, a2, (tt - t0) / (t2 - t0));
  const b2 = lerpPoint(a2, a3, (tt - t1) / (t3 - t1));
  return lerpPoint(b1, b2, (tt - t1) / (t2 - t1));
}

function sampleClosedSpline(points: Vector2[]): Vector2[] {
  const n = points.length;
  const sampled: Vector2[] = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const subdivisions = Math.max(6, Math.min(28, Math.ceil(segmentLength / 26)));

    for (let j = 0; j < subdivisions; j += 1) {
      const t = j / subdivisions;
      sampled.push(catmullRomCentripetal(p0, p1, p2, p3, t));
    }
  }
  return sampled;
}

function getAveragedNormal(points: Vector2[], index: number): Vector2 {
  const n = points.length;
  const prev = points[(index - 1 + n) % n];
  const curr = points[index];
  const next = points[(index + 1) % n];

  const d1 = normalize(curr.x - prev.x, curr.y - prev.y);
  const d2 = normalize(next.x - curr.x, next.y - curr.y);
  const n1 = { x: -d1.y, y: d1.x };
  const n2 = { x: -d2.y, y: d2.x };
  const avg = normalize(n1.x + n2.x, n1.y + n2.y);
  if (Math.abs(avg.x) < 1e-6 && Math.abs(avg.y) < 1e-6) {
    return n2;
  }
  return avg;
}

function lineIntersection(p1: Vector2, d1: Vector2, p2: Vector2, d2: Vector2): Vector2 | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-6) {
    return null;
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

function offsetJoinPoint(points: Vector2[], index: number, halfWidth: number, side: 1 | -1): Vector2 {
  const n = points.length;
  const prev = points[(index - 1 + n) % n];
  const curr = points[index];
  const next = points[(index + 1) % n];

  const dirPrev = normalize(curr.x - prev.x, curr.y - prev.y);
  const dirNext = normalize(next.x - curr.x, next.y - curr.y);

  const nPrev = { x: -dirPrev.y * side, y: dirPrev.x * side };
  const nNext = { x: -dirNext.y * side, y: dirNext.x * side };

  const offsetPrev = { x: curr.x + nPrev.x * halfWidth, y: curr.y + nPrev.y * halfWidth };
  const offsetNext = { x: curr.x + nNext.x * halfWidth, y: curr.y + nNext.y * halfWidth };
  const intersection = lineIntersection(offsetPrev, dirPrev, offsetNext, dirNext);

  const fallbackNormal = getAveragedNormal(points, index);
  const fallback = {
    x: curr.x + fallbackNormal.x * halfWidth * side,
    y: curr.y + fallbackNormal.y * halfWidth * side
  };

  if (!intersection) {
    return fallback;
  }

  const miterLength = Math.hypot(intersection.x - curr.x, intersection.y - curr.y);
  const maxMiter = halfWidth * 2.2;
  if (miterLength > maxMiter) {
    return fallback;
  }

  const blendNormal = { x: nPrev.x + nNext.x, y: nPrev.y + nNext.y };
  const sideCheck = (intersection.x - curr.x) * blendNormal.x + (intersection.y - curr.y) * blendNormal.y;
  if (sideCheck < 0) {
    return fallback;
  }

  return intersection;
}

export function buildTrackGeometry(asset: TrackAssetV1): TrackGeometry {
  const baseCenterline = getClosedCenterline(asset.centerline);
  const centerline = sampleClosedSpline(baseCenterline);
  const halfWidth = asset.roadWidth / 2;

  const leftEdge: Vector2[] = [];
  const rightEdge: Vector2[] = [];
  for (let i = 0; i < centerline.length; i += 1) {
    leftEdge.push(offsetJoinPoint(centerline, i, halfWidth, 1));
    rightEdge.push(offsetJoinPoint(centerline, i, halfWidth, -1));
  }

  const quads: Quad[] = [];
  for (let i = 0; i < centerline.length; i += 1) {
    const next = (i + 1) % centerline.length;
    quads.push([leftEdge[i], rightEdge[i], rightEdge[next], leftEdge[next]]);
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  leftEdge.concat(rightEdge).forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  return {
    sampledCenterline: centerline,
    quads,
    leftEdge,
    rightEdge,
    bounds: { minX, minY, maxX, maxY }
  };
}

export function isOnTrackFromGeometry(x: number, y: number, geometry: TrackGeometry): boolean {
  if (
    x < geometry.bounds.minX ||
    x > geometry.bounds.maxX ||
    y < geometry.bounds.minY ||
    y > geometry.bounds.maxY
  ) {
    return false;
  }

  for (const quad of geometry.quads) {
    if (pointInPolygon({ x, y }, quad)) {
      return true;
    }
  }
  return false;
}

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

  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }
  if (Math.abs(o1) < 1e-6 && onSegment(a1, b1, a2)) {
    return true;
  }
  if (Math.abs(o2) < 1e-6 && onSegment(a1, b2, a2)) {
    return true;
  }
  if (Math.abs(o3) < 1e-6 && onSegment(b1, a1, b2)) {
    return true;
  }
  if (Math.abs(o4) < 1e-6 && onSegment(b1, a2, b2)) {
    return true;
  }
  return false;
}

export function isCenterlineClosed(points: Vector2[]): boolean {
  if (points.length < 3) {
    return false;
  }
  return almostEqual(points[0], points[points.length - 1]);
}
