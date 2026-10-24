import type { Tank } from '../entities/Tank';
import type { AutoPlayer } from '../entities/AutoPlayer';
import type { Bullet } from '../entities/Bullet';
import type { Board } from '../core/Board';
import { moveCircleWithSlide, movePointWithBounces } from '../core/Collision';
import type { Vec2 } from '../math/Vec2';
import { vec2, sub, norm, perp, dot, dist, angleOf, angleDiff } from '../math/Vec2';
import {
  AI_THINK_DT, THREAT_HORIZON, THREAT_MAX_TIME, AIM_TOLERANCE,
  BULLET_LIFETIME, BULLET_MAX_BOUNCES, MUZZLE_GRACE, FIXED_DT, DODGE_TURN_MULT,
} from '../config';

export interface AIIntent {
  /** [-1, 1] forward drive. */
  move: number;
  /** Angle to face. */
  targetAngle: number;
  wantShoot: boolean;
  /** Turn faster this step (used for aggressive dodge turns). */
  fastTurn: boolean;
}

export interface AIContext {
  tanks: Tank[];
  bullets: Bullet[];
  board: Board;
}

interface Threat {
  pos: Vec2;
  dir: Vec2;
  time: number;
}

// Match the bullet lifetime, grace and bounce checks at each physics step.
const SIM_STEP = FIXED_DT;
const DODGE_WALL_HORIZON = 0.3;

/**
 * AutoPlayer brain — priorities:
 *   1. Dodge incoming bullets (turn + move away laterally).
 *   2. Shoot the nearest enemy when safe and roughly aligned.
 *   3. Wander / reposition otherwise.
 */
export class Controller {
  /** Per-AI personality: how steady the aim is (1 = stock, <1 steadier). */
  private readonly aimNoise = 0.6 + Math.random() * 0.9;
  private wanderTarget: Vec2 | null = null;
  private wanderTimer = 0;
  private lastPos: Vec2 | null = null;
  private lastMove = 0;
  private stuckTimer = 0;
  private backingOut = 0;

  think(ai: AutoPlayer, ctx: AIContext): AIIntent {
    // Only a failed movement request indicates a pocket. Holding aim is an
    // intentional stop; compare progress with requested speed so slow backing
    // and fit-to-screen scaling don't produce false recoveries.
    const moved = this.lastPos ? dist(ai.pos, this.lastPos) : Infinity;
    this.lastPos = { x: ai.pos.x, y: ai.pos.y };
    const expected = Math.abs(this.lastMove) * ai.speed * AI_THINK_DT;
    if (expected > 0 && moved < expected * 0.2) this.stuckTimer += AI_THINK_DT;
    else this.stuckTimer = 0;

    let intent: AIIntent;
    const threat = this.findThreat(ai, ctx);
    if (threat) {
      // A live threat must interrupt recovery rather than being ignored until
      // the half-second reversing timer expires.
      this.backingOut = 0;
      this.stuckTimer = 0;
      intent = this.dodge(ai, threat);
    } else if (this.backingOut > 0) {
      this.backingOut -= AI_THINK_DT;
      this.stuckTimer = 0;
      intent = { move: -0.6, targetAngle: ai.angle, wantShoot: false, fastTurn: false };
    } else if (this.stuckTimer > 0.4) {
      this.stuckTimer = 0;
      this.backingOut = 0.5;
      intent = { move: -0.6, targetAngle: ai.angle, wantShoot: false, fastTurn: false };
    } else {
      const target = this.nearestEnemy(ai, ctx.tanks);
      intent = target ? this.attack(ai, target, ctx) : this.wander(ai, ctx);
    }
    this.lastMove = intent.move;
    return intent;
  }

  /** Simulate every bullet a short horizon ahead. A bullet is a threat only if
   *  its predicted path comes within hit range; the reported time is when it
   *  first enters the wider danger radius, so we react early enough to dodge.
   *  Radii scale with the tank's (possibly fit-scaled) size. */
  private findThreat(ai: AutoPlayer, ctx: AIContext): Threat | null {
    let best: Threat | null = null;
    const steps = Math.ceil(THREAT_HORIZON / SIM_STEP);
    for (const b of ctx.bullets) {
      if (b.dead) continue;
      const hitR = ai.len / 2 + b.radius + ai.len * 0.12;
      const dangerR = ai.len / 2 + b.radius + ai.len * 1.2;
      let p = { x: b.pos.x, y: b.pos.y };
      let v = { x: b.vel.x, y: b.vel.y };
      let time = 0;
      let age = b.age;
      let bounces = b.bounces;
      let dangerTime = -1;
      let dangerPos: Vec2 = { x: b.pos.x, y: b.pos.y };
      let dangerDir: Vec2 = { x: v.x, y: v.y };
      for (let i = 0; i < steps; i++) {
        const res = movePointWithBounces(p, v, SIM_STEP, ctx.board, b.radius);
        p = res.pos;
        v = res.vel;
        time += SIM_STEP;
        age += SIM_STEP;
        bounces += res.bounces;
        if (time > THREAT_HORIZON) break;
        if (age > BULLET_LIFETIME || bounces > BULLET_MAX_BOUNCES) break;
        if (b.owner === ai && age < MUZZLE_GRACE) continue;
        const d = dist(p, ai.pos);
        if (d < dangerR && dangerTime < 0) {
          dangerTime = time;
          dangerPos = { x: p.x, y: p.y };
          dangerDir = norm(v);
        }
        if (d < hitR) {
          if (dangerTime >= 0 && dangerTime <= THREAT_MAX_TIME && (!best || dangerTime < best.time)) {
            best = { pos: dangerPos, dir: dangerDir, time: dangerTime };
          }
          break;
        }
      }
    }
    return best;
  }

  /** Prefer a lateral escape with wall clearance and a short turn. Reversing
   *  can start that escape immediately rather than driving toward a wall. */
  private dodge(ai: AutoPlayer, threat: Threat): AIIntent {
    const away = norm(sub(ai.pos, threat.pos));
    const lateral = perp(threat.dir);
    const pick = dot(lateral, away) >= 0 ? lateral : vec2(-lateral.x, -lateral.y);
    const urgency = threat.time < 0.3 ? 1 : 0.5;
    const face = norm(
      vec2(pick.x + away.x * (1 - urgency) * 0.35, pick.y + away.y * (1 - urgency) * 0.35),
    );
    const preferred: AIIntent = { move: 1, targetAngle: angleOf(face), wantShoot: false, fastTurn: true };
    let best = preferred;
    let bestBlocked = this.blockedDodgeTravel(ai, preferred);
    for (const move of [1, -1]) {
      for (const side of [0, Math.PI]) {
        if (move === 1 && side === 0) continue; // already evaluated
        const candidate: AIIntent = {
          move,
          targetAngle: preferred.targetAngle + side + (move < 0 ? Math.PI : 0),
          wantShoot: false,
          fastTurn: true,
        };
        const blocked = this.blockedDodgeTravel(ai, candidate);
        const turn = Math.abs(angleDiff(ai.angle, candidate.targetAngle));
        const bestTurn = Math.abs(angleDiff(ai.angle, best.targetAngle));
        if (blocked < bestBlocked - 0.01 * ai.metrics.scale ||
            (Math.abs(blocked - bestBlocked) <= 0.01 * ai.metrics.scale && turn < bestTurn - 1e-6)) {
          best = candidate;
          bestBlocked = blocked;
        }
      }
    }
    return best;
  }

  /** Account for actual turning and wall sliding, including the movement that
   *  happens before turning in AutoPlayer.update. This only checks wall access;
   *  simultaneous-bullet maneuver planning remains a separate improvement. */
  private blockedDodgeTravel(ai: AutoPlayer, intent: AIIntent): number {
    let pos = { ...ai.pos };
    let angle = ai.angle;
    let blocked = 0;
    for (let i = 0; i < Math.ceil(DODGE_WALL_HORIZON / FIXED_DT); i++) {
      const step = ai.speed * intent.move * FIXED_DT;
      const delta = vec2(Math.cos(angle) * step, Math.sin(angle) * step);
      const next = moveCircleWithSlide(pos, delta, ai.board, ai.radius);
      blocked += Math.hypot(next.x - pos.x - delta.x, next.y - pos.y - delta.y);
      pos = next;
      const diff = angleDiff(angle, intent.targetAngle);
      angle += Math.sign(diff) * Math.min(Math.abs(diff), ai.rotSpeed * DODGE_TURN_MULT * FIXED_DT);
    }
    return blocked;
  }

  private attack(ai: AutoPlayer, target: Tank, ctx: AIContext): AIIntent {
    const aim = angleOf(sub(target.pos, ai.pos));
    const aligned = Math.abs(angleDiff(ai.angle, aim)) < AIM_TOLERANCE;
    const d = dist(ai.pos, target.pos);
    const visible = ai.lineOfSight(target);

    if (!visible) {
      // No line of fire — navigate around the maze toward the target using a
      // BFS path, following the next waypoint cell.
      const start = ctx.board.cellAt(ai.pos.x, ai.pos.y);
      const goal = ctx.board.cellAt(target.pos.x, target.pos.y);
      const path = ctx.board.findPath(start.r, start.c, goal.r, goal.c);
      if (path && path.length > 0) {
        const wp = path[0];
        const wpCenter = ctx.board.cellCenter(wp.r, wp.c);
        return {
          move: 0.75,
          targetAngle: angleOf(sub(wpCenter, ai.pos)),
          wantShoot: false,
          fastTurn: false,
        };
      }
      return this.wander(ai, ctx);
    }

    const jitter = (Math.random() - 0.5) * 0.12 * this.aimNoise;
    let move = 0.55;
    if (aligned) {
      // Hold position to fire; back off if the target is hugging us.
      move = d < 55 * ai.metrics.scale ? -0.35 : 0;
    }
    return {
      move,
      targetAngle: aim + jitter,
      wantShoot: aligned && Math.random() < 0.5,
      fastTurn: false,
    };
  }

  private wander(ai: AutoPlayer, ctx: AIContext): AIIntent {
    this.wanderTimer -= AI_THINK_DT;
    const center = vec2(ctx.board.canvasW / 2, ctx.board.canvasH / 2);
    let target = this.wanderTarget ?? center;
    if (this.wanderTimer <= 0 || dist(ai.pos, target) < 24 * ai.metrics.scale) {
      const r = Math.floor(Math.random() * ctx.board.height);
      const c = Math.floor(Math.random() * ctx.board.width);
      target = ctx.board.cellCenter(r, c);
      this.wanderTarget = target;
      this.wanderTimer = 2 + Math.random() * 2;
    }
    const to = sub(target, ai.pos);
    return { move: 0.55, targetAngle: angleOf(to), wantShoot: false, fastTurn: false };
  }

  private nearestEnemy(ai: AutoPlayer, tanks: Tank[]): Tank | null {
    let best: Tank | null = null;
    let bestD = Infinity;
    for (const t of tanks) {
      if (!t.alive || t === ai) continue;
      const d = dist(ai.pos, t.pos);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
