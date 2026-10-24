import type { AIContext, AIIntent } from './Controller';
import type { AutoPlayer } from '../entities/AutoPlayer';
import type { Bullet } from '../entities/Bullet';
import type { Board } from '../core/Board';
import type { Vec2 } from '../math/Vec2';
import { angleDiff, angleOf, dist, sub, vec2 } from '../math/Vec2';
import { moveCircleWithSlide, movePointWithBounces } from '../core/Collision';
import {
  AI_THINK_DT, AIM_TOLERANCE, BULLET_LIFETIME, BULLET_MAX_BOUNCES,
  DODGE_TURN_MULT, FIXED_DT, MUZZLE_GRACE, THREAT_HORIZON, THREAT_MAX_TIME,
} from '../config';

const HORIZON = Math.min(THREAT_HORIZON, THREAT_MAX_TIME);
const STEPS = Math.ceil(HORIZON / FIXED_DT);

interface Sample {
  pos: Vec2;
  age: number;
}

interface Trajectory {
  bullet: Bullet;
  samples: Sample[];
}

interface CachedTrajectory {
  board: Board;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  bounces: number;
  radius: number;
  samples: Sample[];
}

// Controllers thinking on the same physics step share ricochet simulation.
// Every mutable physics input participates in cache invalidation.
const trajectoryCache = new WeakMap<Bullet, CachedTrajectory>();

function predict(bullet: Bullet, board: Board): Sample[] {
  const cached = trajectoryCache.get(bullet);
  if (cached && cached.board === board && cached.x === bullet.pos.x && cached.y === bullet.pos.y &&
      cached.vx === bullet.vel.x && cached.vy === bullet.vel.y && cached.age === bullet.age &&
      cached.bounces === bullet.bounces && cached.radius === bullet.radius) return cached.samples;

  const samples: Sample[] = [];
  let pos = bullet.pos;
  let vel = bullet.vel;
  let age = bullet.age;
  let bounces = bullet.bounces;
  for (let i = 0; i < STEPS; i++) {
    const next = movePointWithBounces(pos, vel, FIXED_DT, board, bullet.radius);
    pos = next.pos;
    vel = next.vel;
    age += FIXED_DT;
    bounces += next.bounces;
    if (age > BULLET_LIFETIME || bounces > BULLET_MAX_BOUNCES) break;
    samples.push({ pos, age });
  }
  trajectoryCache.set(bullet, {
    board, x: bullet.pos.x, y: bullet.pos.y, vx: bullet.vel.x, vy: bullet.vel.y,
    age: bullet.age, bounces: bullet.bounces, radius: bullet.radius, samples,
  });
  return samples;
}

interface Evaluation {
  hitTime: number;
  score: number;
}

/** Receding-horizon avoidance: all routes obey the real drive/turn physics,
 *  and every relevant bullet is checked at the matching future instant. */
export class EvasionPlanner {
  private previous: AIIntent | null = null;

  plan(ai: AutoPlayer, ctx: AIContext, baseline: AIIntent): AIIntent | null {
    const trajectories: Trajectory[] = [];
    for (const bullet of ctx.bullets) {
      if (bullet.dead) continue;
      // A ricochet cannot cover more distance than the bullet's total travel.
      // Include the tank's whole reachable region, not just its current cell.
      const reach = (Math.hypot(bullet.vel.x, bullet.vel.y) + ai.speed) * HORIZON + ai.len + bullet.radius;
      if (dist(ai.pos, bullet.pos) > reach) continue;
      const samples = predict(bullet, ctx.board);
      if (samples.length) trajectories.push({ bullet, samples });
    }
    if (!trajectories.length || this.evaluate(ai, ctx, baseline, trajectories).hitTime === Infinity) {
      this.previous = null;
      return null;
    }

    const candidates: AIIntent[] = [];
    const add = (move: number, targetAngle: number, fastTurn = true) => {
      if (candidates.some((c) => c.move === move && c.fastTurn === fastTurn &&
          Math.abs(angleDiff(c.targetAngle, targetAngle)) < 1e-6)) return;
      candidates.push({ move, targetAngle, fastTurn, wantShoot: false });
    };
    add(baseline.move, baseline.targetAngle, baseline.fastTurn);
    if (this.previous) add(this.previous.move, this.previous.targetAngle, this.previous.fastTurn);
    add(0, ai.angle);
    add(0, ai.angle + Math.PI / 2);
    add(0, baseline.targetAngle);
    for (let i = 0; i < 8; i++) {
      const angle = ai.angle + i * Math.PI / 4;
      add(1, angle);
      add(-1, angle);
    }

    let best = candidates[0];
    let bestEvaluation = this.evaluate(ai, ctx, best, trajectories);
    for (const candidate of candidates.slice(1)) {
      const evaluation = this.evaluate(ai, ctx, candidate, trajectories);
      // Survival is lexicographic: no aim/continuity bonus can outweigh a hit.
      // If every route is unsafe, maximize the time remaining to react again.
      if (evaluation.hitTime > bestEvaluation.hitTime ||
          (evaluation.hitTime === bestEvaluation.hitTime && evaluation.score > bestEvaluation.score)) {
        best = candidate;
        bestEvaluation = evaluation;
      }
    }
    const canFire = ctx.tanks.some((target) => target !== ai && target.alive &&
      Math.abs(angleDiff(ai.angle, angleOf(sub(target.pos, ai.pos)))) < AIM_TOLERANCE && ai.lineOfSight(target));
    this.previous = { ...best, wantShoot: canFire };
    return this.previous;
  }

  private evaluate(ai: AutoPlayer, ctx: AIContext, intent: AIIntent, trajectories: Trajectory[]): Evaluation {
    let pos = { ...ai.pos };
    let angle = ai.angle;
    let clearance = 4;
    let blocked = 0;
    const margin = ai.len * 0.04;
    for (let i = 0; i < STEPS; i++) {
      const step = ai.speed * intent.move * FIXED_DT;
      const delta = vec2(Math.cos(angle) * step, Math.sin(angle) * step);
      const next = moveCircleWithSlide(pos, delta, ctx.board, ai.radius);
      blocked += dist(next, vec2(pos.x + delta.x, pos.y + delta.y)) / ai.len;
      pos = next;
      const diff = angleDiff(angle, intent.targetAngle);
      const turnRate = ai.rotSpeed * (intent.fastTurn ? DODGE_TURN_MULT : 1);
      angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * FIXED_DT);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const { bullet, samples } of trajectories) {
        const sample = samples[i];
        if (!sample || (bullet.owner === ai && sample.age < MUZZLE_GRACE)) continue;
        const dx = sample.pos.x - pos.x;
        const dy = sample.pos.y - pos.y;
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const a = ai.len / 2 + bullet.radius + margin;
        const b = ai.wid / 2 + bullet.radius + margin;
        const separation = (lx * lx) / (a * a) + (ly * ly) / (b * b);
        clearance = Math.min(clearance, separation);
        if (separation <= 1) return { hitTime: (i + 1) * FIXED_DT, score: clearance - blocked };
      }
    }
    const turn = Math.abs(angleDiff(ai.angle, intent.targetAngle));
    const sameManeuver = this.previous && this.previous.move === intent.move &&
      Math.abs(angleDiff(this.previous.targetAngle, intent.targetAngle)) < 0.3;
    // A small continuity preference prevents switching between equally safe
    // escapes. It is never used to retain an unsafe route over a safe one.
    const continuity = sameManeuver ? AI_THINK_DT * 6 : 0;
    let aim = Math.PI;
    for (const target of ctx.tanks) {
      if (target === ai || !target.alive) continue;
      aim = Math.min(aim, Math.abs(angleDiff(angle, angleOf(sub(target.pos, pos)))));
    }
    return { hitTime: Infinity, score: clearance - blocked * 2 - turn * 0.05 - aim * 0.1 + continuity };
  }
}
