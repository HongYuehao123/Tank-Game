import type { Tank } from '../entities/Tank';
import type { AutoPlayer } from '../entities/AutoPlayer';
import type { Bullet } from '../entities/Bullet';
import type { Board } from '../core/Board';
import { movePointWithBounces } from '../core/Collision';
import type { Vec2 } from '../math/Vec2';
import { vec2, sub, norm, perp, dot, dist, angleOf, angleDiff } from '../math/Vec2';
import { AI_THINK_DT, THREAT_HORIZON, AIM_TOLERANCE } from '../config';

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

const THREAT_MAX_TIME = 1.0; // horizon for a predicted hit
const SIM_STEP = 1 / 30;

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
  private stuckTimer = 0;
  private backingOut = 0;

  think(ai: AutoPlayer, ctx: AIContext): AIIntent {
    // Back out of a pocket if we've been making no progress (e.g. wedged into
    // a corner by walls) — reversing along our facing escapes it.
    // Pixel thresholds scale with the (possibly fit-scaled) world size.
    const s = ai.metrics.scale;
    const moved = this.lastPos ? dist(ai.pos, this.lastPos) : Infinity;
    this.lastPos = { x: ai.pos.x, y: ai.pos.y };
    if (this.backingOut > 0) {
      this.backingOut -= AI_THINK_DT;
      return { move: -0.6, targetAngle: ai.angle, wantShoot: false, fastTurn: false };
    }
    if (moved < 1.5 * s) this.stuckTimer += AI_THINK_DT;
    else this.stuckTimer = Math.max(0, this.stuckTimer - AI_THINK_DT * 2);
    if (this.stuckTimer > 0.4) {
      this.stuckTimer = 0;
      this.backingOut = 0.5;
      return { move: -0.6, targetAngle: ai.angle, wantShoot: false, fastTurn: false };
    }

    const threat = this.findThreat(ai, ctx);
    if (threat) return this.dodge(ai, threat);

    const target = this.nearestEnemy(ai, ctx.tanks);
    if (target) return this.attack(ai, target, ctx);

    return this.wander(ai, ctx);
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
      if (b.owner === ai && b.age < 0.3) continue;
      const hitR = ai.len / 2 + b.radius + ai.len * 0.12;
      const dangerR = ai.len / 2 + b.radius + ai.len * 1.2;
      let p = { x: b.pos.x, y: b.pos.y };
      let v = { x: b.vel.x, y: b.vel.y };
      let time = 0;
      let minD = Infinity;
      let dangerTime = -1;
      let dangerPos: Vec2 = { x: b.pos.x, y: b.pos.y };
      let dangerDir: Vec2 = { x: v.x, y: v.y };
      for (let i = 0; i < steps; i++) {
        const res = movePointWithBounces(p, v, SIM_STEP, ctx.board, b.radius);
        p = res.pos;
        v = res.vel;
        time += SIM_STEP;
        if (time > THREAT_HORIZON) break;
        const d = dist(p, ai.pos);
        if (d < dangerR && dangerTime < 0) {
          dangerTime = time;
          dangerPos = { x: p.x, y: p.y };
          dangerDir = norm(v);
        }
        if (d < minD) minD = d;
      }
      if (minD < hitR && dangerTime >= 0 && dangerTime <= THREAT_MAX_TIME) {
        if (!best || dangerTime < best.time) {
          best = { pos: dangerPos, dir: dangerDir, time: dangerTime };
        }
      }
    }
    return best;
  }

  /** Snap across the bullet's path and drive — presenting the narrow profile
   *  while sliding out of the way. Uses a boosted turn rate and commits hard to
   *  the lateral when the hit is imminent. */
  private dodge(ai: AutoPlayer, threat: Threat): AIIntent {
    const away = norm(sub(ai.pos, threat.pos));
    const lateral = perp(threat.dir);
    const pick = dot(lateral, away) >= 0 ? lateral : vec2(-lateral.x, -lateral.y);
    const urgency = threat.time < 0.3 ? 1 : 0.5;
    const face = norm(
      vec2(pick.x + away.x * (1 - urgency) * 0.35, pick.y + away.y * (1 - urgency) * 0.35),
    );
    return { move: 1, targetAngle: angleOf(face), wantShoot: false, fastTurn: true };
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
