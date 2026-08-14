import type { Board } from '../core/Board';
import { movePointWithBounces, bulletHitsTank } from '../core/Collision';
import type { Vec2 } from '../math/Vec2';
import { vec2 } from '../math/Vec2';
import { BULLET_LIFETIME, BULLET_MAX_BOUNCES, MUZZLE_GRACE } from '../config';
import type { Tank } from './Tank';

/**
 * A bullet. Every bullet is identical (same color, same behavior) and can kill
 * ANY tank it touches — including the shooter. `owner` is only used for AI
 * threat attribution, never for collision immunity.
 */
export class Bullet {
  pos: Vec2;
  vel: Vec2;
  owner: Tank | null;
  radius: number;
  age = 0;
  bounces = 0;
  dead = false;

  constructor(pos: Vec2, vel: Vec2, owner: Tank | null, radius: number) {
    this.pos = vec2(pos.x, pos.y);
    this.vel = vec2(vel.x, vel.y);
    this.owner = owner;
    this.radius = radius;
  }

  /** Returns the tank hit this step, or null. */
  update(dt: number, board: Board, tanks: Tank[]): Tank | null {
    const res = movePointWithBounces(this.pos, this.vel, dt, board, this.radius);
    this.pos = res.pos;
    this.vel = res.vel;
    this.bounces += res.bounces;
    this.age += dt;

    if (this.age > BULLET_LIFETIME || this.bounces > BULLET_MAX_BOUNCES) {
      this.dead = true;
      return null;
    }

    for (const t of tanks) {
      if (!t.alive) continue;
      if (t === this.owner && this.age < MUZZLE_GRACE) continue;
      if (bulletHitsTank(this.pos.x, this.pos.y, this.radius, t)) {
        this.dead = true;
        return t;
      }
    }
    return null;
  }
}
