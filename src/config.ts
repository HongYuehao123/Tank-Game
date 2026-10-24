/* Central tunables and the shared ResolvedHorse-inspired paper palette. */

export const MIN_BOARD = 5;
export const MAX_BOARD = 20;

export const TANK_LEN = 34; // body length (px) — hitbox ellipse major axis
export const TANK_WID = 22; // body width (px) — hitbox ellipse minor axis
export const TANK_RADIUS = 20; // movement clearance (bounding circle)

/** Every block must be at least 4× the tank width and 2× the tank length. */
export const BASE_CELL = Math.max(4 * TANK_WID, 2 * TANK_LEN); // 88px

export const WALL_THICKNESS = 6; // base thickness of wall lines

export const TANK_SPEED = 150; // px/s (1.25× base)
export const TANK_ROT_SPEED = 3.6; // rad/s (classic player mode)
export const MODERN_ROT_SPEED = 10; // rad/s (modern mouse-aim turn rate)

export const AI_SPEED = 135; // px/s (1.25× base)
export const AI_ROT_SPEED = 3.0; // rad/s
/** Extra turn rate the AI uses while dodging (aggressive evasive turns). */
export const DODGE_TURN_MULT = 2.2;

export const BULLET_SPEED = 340; // px/s (base; scales with the speed multiplier)
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
  bg: '#F6F3EB', // continuous cream canvas
  wall: '#727568', // muted olive wall lines
  player: '#385B45', // forest green
  playerDark: '#252820',
  bullet: '#C84C27', // burnt orange, shared by every bullet
  text: '#252820',
  muted: '#727568',
  tread: 'rgba(37, 40, 32, 0.3)',
  barrel: '#252820',
} as const;

export const AI_COLORS: string[] = [
  '#C84C27',
  '#936B45',
  '#657788',
  '#8A7534',
  '#896779',
  '#4E7C75',
];

/** Burnt orange distinguishes the First-to-x opponent from the green player. */
export const TOURNAMENT_AI_COLOR = '#C84C27';

/** First-to-x "first to X" bounds: at least 1, no upper limit. */
export const MIN_FIRST_TO = 1;
export const DEFAULT_FIRST_TO = 5;
