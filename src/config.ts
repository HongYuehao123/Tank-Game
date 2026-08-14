/* Central tunables and the shared color palette (light theme). */

export const MIN_BOARD = 5;
export const MAX_BOARD = 20;

export const TANK_LEN = 34; // body length (px) — hitbox ellipse major axis
export const TANK_WID = 22; // body width (px) — hitbox ellipse minor axis
export const TANK_RADIUS = 20; // movement clearance (bounding circle)

/** Every block must be at least 4× the tank width and 2× the tank length. */
export const BASE_CELL = Math.max(4 * TANK_WID, 2 * TANK_LEN); // 88px

export const WALL_THICKNESS = 6; // base thickness of wall lines

export const TANK_SPEED = 150; // px/s (1.25× base)
export const TANK_ROT_SPEED = 3.6; // rad/s (classic mode + AI base)
export const MODERN_ROT_SPEED = 10; // rad/s (modern mouse-aim turn rate)

export const AI_SPEED = 135; // px/s (1.25× base)
export const AI_ROT_SPEED = 3.0; // rad/s
/** Extra turn rate the AI uses while dodging (aggressive evasive turns). */
export const DODGE_TURN_MULT = 2.2;

export const BULLET_SPEED = 230; // px/s
export const BULLET_RADIUS = 5;
export const BULLET_LIFETIME = 5; // seconds
export const BULLET_MAX_BOUNCES = 8;
export const SHOOT_COOLDOWN = 0.45; // seconds
export const AI_SHOOT_COOLDOWN = 0.7; // seconds (AI fires more slowly)
/** Owner-only muzzle grace: a bullet can't hit its shooter in its first instants
 *  of life (prevents unavoidable point-blank wall-bounce suicides). Ricochet
 *  self-kills still work — every bullet is otherwise identical for everyone. */
export const MUZZLE_GRACE = 0.12; // seconds

export const FIXED_DT = 1 / 120; // fixed simulation step
export const AI_THINK_DT = 1 / 30; // AI decision interval

export const WALL_PROB = 0.3; // random density of interior wall segments

export const THREAT_HORIZON = 1.4; // seconds of bullet-path prediction
export const THREAT_MAX_TIME = 1.0; // seconds — dodge only imminent hits
export const AIM_TOLERANCE = 0.2; // radians

export const PALETTE = {
  bg: '#eef1f6', // off-white arena
  wall: '#3f4a5f', // dark slate — wall lines
  player: '#0e7490', // deep cyan (player tank)
  playerDark: '#0b2a33',
  bullet: '#d97706', // amber — readable on white
  text: '#1f2937',
  tread: 'rgba(0, 0, 0, 0.25)',
  barrel: '#1f2937',
} as const;

export const AI_COLORS: string[] = [
  '#f97316',
  '#ef4444',
  '#e879f9',
  '#facc15',
  '#8b5cf6',
  '#4ade80',
];
