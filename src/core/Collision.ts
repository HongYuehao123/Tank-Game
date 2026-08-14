import type { Board } from './Board';
import type { Rect } from '../math/geometry';
import { segmentVsAABB, pointInRect, rotatedRectCorners, pointInRotatedRect } from '../math/geometry';
import type { Vec2 } from '../math/Vec2';
import { vec2, angleDiff } from '../math/Vec2';
import type { Tank } from '../entities/Tank';

export interface MoveResult {
  pos: Vec2;
  vel: Vec2;
  bounces: number;
}

/**
 * Move a point (bullet center) by `v * dt`, reflecting off walls.
 * `radius` inflates the walls so the bullet's own size is respected.
 */
export function movePointWithBounces(p0: Vec2, v: Vec2, dt: number, board: Board, radius: number): MoveResult {
  const pos = { x: p0.x, y: p0.y };
  const vel = { x: v.x, y: v.y };
  let remaining = dt;
  let bounces = 0;

  for (let iter = 0; iter < 12 && remaining > 1e-9; iter++) {
    // If we are inside an inflated wall rect (spawned in one, or pushed onto a
    // boundary), push out to the nearest face and reflect, instead of stalling.
    const containment = resolveContainment(pos, board, radius);
    if (containment) {
      pos.x += containment.nx * 0.05;
      pos.y += containment.ny * 0.05;
      const dotN = vel.x * containment.nx + vel.y * containment.ny;
      if (dotN < 0) {
        vel.x -= 2 * dotN * containment.nx;
        vel.y -= 2 * dotN * containment.ny;
        bounces++;
      }
      continue;
    }

    const p1 = vec2(pos.x + vel.x * remaining, pos.y + vel.y * remaining);
    const walls = board.wallsInBBox(pos.x, pos.y, p1.x, p1.y);
    let best: { t: number; nx: number; ny: number } | null = null;
    for (const w of walls) {
      const inflated: Rect = { x: w.x - radius, y: w.y - radius, w: w.w + 2 * radius, h: w.h + 2 * radius };
      const hit = segmentVsAABB(pos, p1, inflated);
      if (hit && (best === null || hit.t < best.t)) best = hit;
    }
    if (!best) {
      pos.x = p1.x;
      pos.y = p1.y;
      break;
    }
    const tHit = Math.max(best.t - 1e-5, 0);
    pos.x += vel.x * remaining * tHit;
    pos.y += vel.y * remaining * tHit;
    remaining *= 1 - tHit;
    const dotN = vel.x * best.nx + vel.y * best.ny;
    if (dotN < 0) {
      vel.x -= 2 * dotN * best.nx;
      vel.y -= 2 * dotN * best.ny;
      bounces++;
    }
    // Nudge clear of the wall face.
    pos.x += best.nx * 0.05;
    pos.y += best.ny * 0.05;
  }
  return { pos, vel, bounces };
}

/** If `pos` is inside an inflated wall rect, return the outward normal of the nearest face. */
function resolveContainment(pos: Vec2, board: Board, radius: number): { nx: number; ny: number } | null {
  const walls = board.wallsInBBox(pos.x - radius - 1, pos.y - radius - 1, pos.x + radius + 1, pos.y + radius + 1);
  for (const w of walls) {
    const inflated: Rect = { x: w.x - radius, y: w.y - radius, w: w.w + 2 * radius, h: w.h + 2 * radius };
    if (pointInRect(pos.x, pos.y, inflated)) {
      const cx = inflated.x + inflated.w / 2;
      const cy = inflated.y + inflated.h / 2;
      const hw = inflated.w / 2;
      const hh = inflated.h / 2;
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const ox = hw - Math.abs(dx);
      const oy = hh - Math.abs(dy);
      if (ox < oy) return { nx: dx >= 0 ? 1 : -1, ny: 0 };
      return { nx: 0, ny: dy >= 0 ? 1 : -1 };
    }
  }
  return null;
}

/**
 * Move a circle (tank) by `delta`, resolving overlaps with walls by sliding
 * along the axis of least penetration. Keeps the center >= radius from walls.
 */
export function moveCircleWithSlide(pos: Vec2, delta: Vec2, board: Board, radius: number): Vec2 {
  const p = vec2(pos.x + delta.x, pos.y + delta.y);
  for (let pass = 0; pass < 4; pass++) {
    let collided = false;
    const walls = board.wallsInBBox(p.x - radius, p.y - radius, p.x + radius, p.y + radius);
    for (const w of walls) {
      const inflated: Rect = { x: w.x - radius, y: w.y - radius, w: w.w + 2 * radius, h: w.h + 2 * radius };
      if (pointInRect(p.x, p.y, inflated)) {
        const cx = inflated.x + inflated.w / 2;
        const cy = inflated.y + inflated.h / 2;
        const hw = inflated.w / 2;
        const hh = inflated.h / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const ox = hw - Math.abs(dx);
        const oy = hh - Math.abs(dy);
        if (ox < oy) p.x = cx + (dx >= 0 ? 1 : -1) * hw;
        else p.y = cy + (dy >= 0 ? 1 : -1) * hh;
        collided = true;
      }
    }
    if (!collided) break;
  }
  return p;
}

/** Does the rotated tank rectangle touch any wall? Used by the rotation clamp. */
export function rotatedRectOverlapsWalls(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  board: Board,
): boolean {
  const corners = rotatedRectCorners(cx, cy, w, h, angle);
  const walls = board.wallsInBBox(cx - w / 2 - 2, cy - h / 2 - 2, cx + w / 2 + 2, cy + h / 2 + 2);
  for (const wall of walls) {
    for (const c of corners) {
      if (pointInRect(c.x, c.y, wall)) return true;
    }
    if (pointInRotatedRect(wall.x, wall.y, cx, cy, w, h, angle)) return true;
    if (pointInRotatedRect(wall.x + wall.w, wall.y, cx, cy, w, h, angle)) return true;
    if (pointInRotatedRect(wall.x, wall.y + wall.h, cx, cy, w, h, angle)) return true;
    if (pointInRotatedRect(wall.x + wall.w, wall.y + wall.h, cx, cy, w, h, angle)) return true;
  }
  return false;
}

/**
 * Rotate from `fromAngle` toward `targetAngle`, but never past the angle at
 * which the tank rectangle would touch a wall. Returns the allowed new angle.
 */
export function clampRotation(
  cx: number,
  cy: number,
  w: number,
  h: number,
  fromAngle: number,
  targetAngle: number,
  board: Board,
  maxStep: number,
): number {
  const diff = angleDiff(fromAngle, targetAngle);
  const dir = diff >= 0 ? 1 : -1;
  const step = Math.min(Math.abs(diff), maxStep);
  if (step <= 0) return fromAngle;
  if (!rotatedRectOverlapsWalls(cx, cy, w, h, fromAngle + dir * step, board)) {
    return fromAngle + dir * step;
  }
  let lo = 0;
  let hi = step;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (rotatedRectOverlapsWalls(cx, cy, w, h, fromAngle + dir * mid, board)) hi = mid;
    else lo = mid;
  }
  return fromAngle + dir * lo;
}

/**
 * Ellipse (tank body aligned to its facing) vs bullet-circle overlap.
 * Turning the tank changes its profile — the core "turn to dodge" mechanic.
 */
export function bulletHitsTank(bx: number, by: number, bulletR: number, tank: Tank): boolean {
  const dx = bx - tank.pos.x;
  const dy = by - tank.pos.y;
  const cos = Math.cos(tank.angle);
  const sin = Math.sin(tank.angle);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const a = tank.len / 2 + bulletR;
  const b = tank.wid / 2 + bulletR;
  return (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
}
