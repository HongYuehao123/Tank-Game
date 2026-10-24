import type { Tank } from '../entities/Tank';
import type { AutoPlayer } from '../entities/AutoPlayer';
import type { Bullet } from '../entities/Bullet';
import type { Board } from '../core/Board';
import { EvasionPlanner } from './EvasionPlanner';
import type { Vec2 } from '../math/Vec2';
import { vec2, sub, dist, angleOf, angleDiff } from '../math/Vec2';
import { AI_THINK_DT, AIM_TOLERANCE } from '../config';

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

/**
 * AutoPlayer brain — priorities:
 *   1. Choose a safe route through predicted incoming bullets.
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
  private evasion = new EvasionPlanner();

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
    if (this.backingOut > 0) {
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
    const evasiveIntent = this.evasion.plan(ai, ctx, intent);
    if (evasiveIntent) {
      this.backingOut = 0;
      this.stuckTimer = 0;
      intent = evasiveIntent;
    }
    this.lastMove = intent.move;
    return intent;
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
