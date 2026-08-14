import { Tank } from './Tank';
import { moveCircleWithSlide, clampRotation } from '../core/Collision';
import { vec2, norm, angleOf, angleDiff } from '../math/Vec2';
import { MODERN_ROT_SPEED } from '../config';
import type { ControlMode, InputState } from '../types';

/**
 * The human-controlled tank.
 *
 * Classic (Robot Centered): W/S drive, A/D turn, Space shoots.
 * Modern (Field Centered): WASD move in field coordinates, the body always
 * rotates toward the mouse (clamped so it never wedges into a wall),
 * Click/Space shoots.
 */
export class Player extends Tank {
  isPlayer = true;
  controlMode: ControlMode = 'classic';
  input: InputState = { keys: {}, mouse: { x: 0, y: 0 }, shoot: false };

  update(dt: number): void {
    super.update(dt);
    if (!this.alive) return;

    if (this.controlMode === 'classic') {
      const fwd = (this.input.keys['KeyW'] ? 1 : 0) - (this.input.keys['KeyS'] ? 1 : 0);
      this.moveForward(dt, fwd);
      const rot = (this.input.keys['KeyA'] ? 1 : 0) - (this.input.keys['KeyD'] ? 1 : 0);
      this.rotate(dt, rot);
    } else {
      // Field-centered movement (screen axes), diagonals normalized.
      const mx = (this.input.keys['KeyD'] ? 1 : 0) - (this.input.keys['KeyA'] ? 1 : 0);
      const my = (this.input.keys['KeyS'] ? 1 : 0) - (this.input.keys['KeyW'] ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const dir = norm(vec2(mx, my));
        const delta = vec2(dir.x * this.speed * dt, dir.y * this.speed * dt);
        this.pos = moveCircleWithSlide(this.pos, delta, this.board, this.radius);
      }
      // Aim at the mouse, but never rotate into a wall.
      const target = angleOf(vec2(this.input.mouse.x - this.pos.x, this.input.mouse.y - this.pos.y));
      if (Math.abs(angleDiff(this.angle, target)) > 1e-4) {
        this.angle = clampRotation(
          this.pos.x,
          this.pos.y,
          this.len,
          this.wid,
          this.angle,
          target,
          this.board,
          MODERN_ROT_SPEED * dt,
        );
      }
    }

    if (this.input.shoot) {
      this.shoot();
      this.input.shoot = false;
    }
  }
}
