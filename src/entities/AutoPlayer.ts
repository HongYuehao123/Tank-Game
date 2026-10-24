import { Tank } from './Tank';
import { angleDiff, angleOf, sub } from '../math/Vec2';
import { AI_THINK_DT, AI_SHOOT_COOLDOWN, AI_ROT_SPEED, DODGE_TURN_MULT, AIM_TOLERANCE } from '../config';
import type { AIContext, AIIntent } from '../ai/Controller';
import { Controller } from '../ai/Controller';

/** AI-driven tank; decisions come from its own Controller instance. */
export class AutoPlayer extends Tank {
  speed = this.metrics.aiSpeed;
  rotSpeed = AI_ROT_SPEED;
  private controller = new Controller();
  private thinkTimer = Math.random() * AI_THINK_DT; // stagger AIs slightly
  private intent: AIIntent = { move: 0, targetAngle: this.angle, wantShoot: false, fastTurn: false };

  update(dt: number, ctx?: AIContext): void {
    super.update(dt);
    if (!this.alive) return;

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0 && ctx) {
      this.thinkTimer = AI_THINK_DT;
      this.intent = this.controller.think(this, ctx);
    }

    this.moveForward(dt, this.intent.move);

    const diff = angleDiff(this.angle, this.intent.targetAngle);
    const turnSpeed = this.intent.fastTurn ? this.rotSpeed * DODGE_TURN_MULT : this.rotSpeed;
    const step = turnSpeed * dt;
    if (Math.abs(diff) <= step) this.angle = this.intent.targetAngle;
    else this.angle += Math.sign(diff) * step;

    // The intent can be several physics steps old. Check the actual facing
    // after movement/turning so evasive turns never fire a stale aimed shot.
    if (this.intent.wantShoot && ctx && ctx.tanks.some((target) =>
      target !== this && target.alive &&
      Math.abs(angleDiff(this.angle, angleOf(sub(target.pos, this.pos)))) < AIM_TOLERANCE &&
      this.lineOfSight(target))) {
      this.shoot(AI_SHOOT_COOLDOWN);
    }
  }
}
