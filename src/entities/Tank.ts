import type { Board } from '../core/Board';
import { moveCircleWithSlide } from '../core/Collision';
import type { WorldMetrics } from '../core/metrics';
import type { Vec2 } from '../math/Vec2';
import { vec2, fromAngle } from '../math/Vec2';
import { segmentVsAABB } from '../math/geometry';
import { TANK_ROT_SPEED, SHOOT_COOLDOWN } from '../config';
import { Bullet } from './Bullet';

export class Tank {
  readonly board: Board;
  readonly metrics: WorldMetrics;
  pos: Vec2;
  angle: number;
  alive = true;

  len: number;
  wid: number;
  radius: number;
  speed: number;
  rotSpeed = TANK_ROT_SPEED;

  cooldown = 0;
  name: string;
  color: string;
  isPlayer = false;

  /** Bullets created this frame; the Game drains this queue after updates. */
  readonly fired: Bullet[] = [];

  constructor(board: Board, spawn: Vec2, name: string, color: string, metrics: WorldMetrics) {
    this.board = board;
    this.metrics = metrics;
    this.pos = { x: spawn.x, y: spawn.y };
    this.name = name;
    this.color = color;
    this.len = metrics.tankLen;
    this.wid = metrics.tankWid;
    this.radius = metrics.tankRadius;
    this.speed = metrics.tankSpeed;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /** amount in [-1, 1]; positive drives toward the facing direction. */
  moveForward(dt: number, amount: number): void {
    if (!this.alive || amount === 0) return;
    const dir = fromAngle(this.angle);
    const delta = vec2(dir.x * this.speed * amount * dt, dir.y * this.speed * amount * dt);
    this.pos = moveCircleWithSlide(this.pos, delta, this.board, this.radius);
  }

  /** dir in [-1, 1]; positive rotates counter-clockwise (left). */
  rotate(dt: number, dir: number): void {
    if (!this.alive || dir === 0) return;
    this.angle += dir * this.rotSpeed * dt;
  }

  /** True when the muzzle point is inside a wall — firing would spawn a bullet
   *  inside geometry (and the reflection would insta-kill the shooter). */
  muzzleBlocked(): boolean {
    const dir = fromAngle(this.angle);
    const mx = this.pos.x + dir.x * (this.len / 2 + 6 * this.metrics.scale);
    const my = this.pos.y + dir.y * (this.len / 2 + 6 * this.metrics.scale);
    return this.board.wallsInBBox(mx, my, mx, my).some(
      (w) => mx >= w.x && mx <= w.x + w.w && my >= w.y && my <= w.y + w.h,
    );
  }

  /** True when a straight line from this tank to `target` is not blocked by a wall. */
  lineOfSight(target: Tank): boolean {
    const walls = this.board.wallsInBBox(
      this.pos.x,
      this.pos.y,
      target.pos.x,
      target.pos.y,
    );
    for (const w of walls) {
      if (segmentVsAABB({ x: this.pos.x, y: this.pos.y }, { x: target.pos.x, y: target.pos.y }, w)) {
        return false;
      }
    }
    return true;
  }

  shoot(cooldown = SHOOT_COOLDOWN): void {
    if (!this.alive || this.cooldown > 0) return;
    if (this.muzzleBlocked()) return; // never spawn a bullet inside a wall
    this.cooldown = cooldown;
    const dir = fromAngle(this.angle);
    const muzzle = vec2(
      this.pos.x + dir.x * (this.len / 2 + 6 * this.metrics.scale),
      this.pos.y + dir.y * (this.len / 2 + 6 * this.metrics.scale),
    );
    const vel = vec2(dir.x * this.metrics.bulletSpeed, dir.y * this.metrics.bulletSpeed);
    this.fired.push(new Bullet(muzzle, vel, this, this.metrics.bulletRadius));
  }
}
