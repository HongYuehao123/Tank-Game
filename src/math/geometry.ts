import type { Vec2 } from './Vec2';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const pointInRect = (px: number, py: number, r: Rect): boolean =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/** Corners of an axis-aligned-centered rectangle rotated by `angle` around (cx, cy). */
export function rotatedRectCorners(cx: number, cy: number, w: number, h: number, angle: number): Vec2[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: cx - hw * cos + hh * sin, y: cy - hw * sin - hh * cos },
    { x: cx + hw * cos + hh * sin, y: cy + hw * sin - hh * cos },
    { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
    { x: cx - hw * cos - hh * sin, y: cy - hw * sin + hh * cos },
  ];
}

/** Is a world point inside the rectangle centered at (cx, cy) rotated by `angle`? */
export function pointInRotatedRect(
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}

export interface SegHit {
  /** Entry fraction along the segment in [0, 1]. */
  t: number;
  /** Outward normal of the face the segment entered. */
  nx: number;
  ny: number;
}

/** Slab-method segment vs AABB intersection; returns the earliest entry hit or null. */
export function segmentVsAABB(p0: Vec2, p1: Vec2, r: Rect): SegHit | null {
  // The segment must start outside the rect; containment is resolved by callers.
  if (pointInRect(p0.x, p0.y, r)) return null;
  const minX = r.x;
  const maxX = r.x + r.w;
  const minY = r.y;
  const maxY = r.y + r.h;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let tEnter = 0;
  let tExit = 1;
  let nx = 0;
  let ny = 0;

  if (Math.abs(dx) < 1e-12) {
    if (p0.x < minX || p0.x > maxX) return null;
  } else {
    let t1 = (minX - p0.x) / dx;
    let t2 = (maxX - p0.x) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      nx = dx > 0 ? -1 : 1;
      ny = 0;
    }
    tExit = Math.min(tExit, t2);
    if (tEnter > tExit) return null;
  }

  if (Math.abs(dy) < 1e-12) {
    if (p0.y < minY || p0.y > maxY) return null;
  } else {
    let t1 = (minY - p0.y) / dy;
    let t2 = (maxY - p0.y) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      nx = 0;
      ny = dy > 0 ? -1 : 1;
    }
    tExit = Math.min(tExit, t2);
    if (tEnter > tExit) return null;
  }

  if (tEnter < 0 || tEnter > 1) return null;
  return { t: tEnter, nx, ny };
}
