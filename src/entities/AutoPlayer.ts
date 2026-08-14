import { Tank } from './Tank';
import { angleDiff } from '../math/Vec2';
import { AI_THINK_DT, AI_SHOOT_COOLDOWN, DODGE_TURN_MULT } from '../config';
import type { AIContext, AIIntent } from '../ai/Controller';
import { Controller } from '../ai/Controller';

/** AI-driven tank; decisions come from its own Controller instance. */
export class AutoPlayer extends Tank {
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

    if (this.intent.wantShoot) {
      this.shoot(AI_SHOOT_COOLDOWN);
    }
  }
}
