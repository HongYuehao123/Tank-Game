import {
  BASE_CELL,
  TANK_LEN,
  TANK_WID,
  TANK_RADIUS,
  BULLET_RADIUS,
  WALL_THICKNESS,
  TANK_SPEED,
  AI_SPEED,
  BULLET_SPEED,
} from '../config';

/** Scaled world sizes for one match. Everything shrinks together so the whole
 *  board fits the screen while keeping the block ≥ 4× tank width / 2× length. */
export interface WorldMetrics {
  cell: number;
  /** 1 = base size; <1 = board was shrunk to fit the viewport. */
  scale: number;
  tankLen: number;
  tankWid: number;
  tankRadius: number;
  bulletRadius: number;
  wallThickness: number;
  tankSpeed: number;
  aiSpeed: number;
  bulletSpeed: number;
}

export function computeWorldMetrics(
  width: number,
  height: number,
  availW: number,
  availH: number,
  speedMultiplier = 1,
): WorldMetrics {
  const naturalW = width * BASE_CELL;
  const naturalH = height * BASE_CELL;
  const scale = Math.max(0.2, Math.min(1, availW / naturalW, availH / naturalH));
  return {
    cell: BASE_CELL * scale,
    scale,
    tankLen: TANK_LEN * scale,
    tankWid: TANK_WID * scale,
    tankRadius: TANK_RADIUS * scale,
    bulletRadius: BULLET_RADIUS * scale,
    wallThickness: Math.max(2, WALL_THICKNESS * scale),
    tankSpeed: TANK_SPEED * scale * speedMultiplier,
    aiSpeed: AI_SPEED * scale * speedMultiplier,
    bulletSpeed: BULLET_SPEED * scale * speedMultiplier,
  };
}
