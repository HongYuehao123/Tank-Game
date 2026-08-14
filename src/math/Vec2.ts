export interface Vec2 {
  x: number;
  y: number;
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => vec2(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec2(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec2(a.x * s, a.y * s);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? vec2(a.x / l, a.y / l) : vec2(0, 0);
};
/** 90° counter-clockwise perpendicular. */
export const perp = (a: Vec2): Vec2 => vec2(-a.y, a.x);
export const fromAngle = (a: number): Vec2 => vec2(Math.cos(a), Math.sin(a));
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

/** Shortest signed difference (target - from) in [-PI, PI]. */
export const angleDiff = (from: number, target: number): number => {
  let d = (target - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
