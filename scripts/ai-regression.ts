/** Focused AI behavior regressions. Run with node --import tsx scripts/ai-regression.ts. */
import assert from 'node:assert/strict';
import { Controller } from '../src/ai/Controller';
import { Board, mulberry32 } from '../src/core/Board';
import { computeWorldMetrics } from '../src/core/metrics';
import { AutoPlayer } from '../src/entities/AutoPlayer';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import type { Rect } from '../src/math/geometry';
import { AI_ROT_SPEED, AI_THINK_DT, BULLET_MAX_BOUNCES, FIXED_DT } from '../src/config';

const metrics = computeWorldMetrics(10, 10, 10000, 10000);
let failures = 0;
let checks = 0;

function test(name: string, run: () => void): void {
  checks++;
  const originalRandom = Math.random;
  Math.random = mulberry32(12345);
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`  ✗ ${name}`, error);
  } finally {
    Math.random = originalRandom;
  }
}

function fixture(walls: Rect[] = []) {
  const board = new Board(10, 10, false, metrics, 1);
  // Isolate the behavior from maze generation; collision still uses real walls.
  board.wallsInBBox = () => walls;
  const ai = new AutoPlayer(board, { x: 300, y: 300 }, 'AI', 'red', metrics);
  ai.angle = 0;
  const target = new Tank(board, { x: 600, y: 300 }, 'Target', 'blue', metrics);
  const controller = new Controller();
  const ctx = { board, tanks: [ai, target], bullets: [] as Bullet[] };
  return { board, ai, target, controller, ctx };
}

function incoming(x = 200, owner: Tank | null = null, age = 0): Bullet {
  const b = new Bullet({ x, y: 300 }, { x: metrics.bulletSpeed, y: 0 }, owner, metrics.bulletRadius);
  b.age = age;
  return b;
}

test('holding aim does not trigger stuck recovery', () => {
  const { ai, controller, ctx } = fixture();
  for (let i = 0; i < 60; i++) assert.equal(controller.think(ai, ctx).move, 0);
});

test('blocked requested movement still triggers recovery', () => {
  const { ai, controller, ctx } = fixture();
  ai.angle = Math.PI / 2;
  let reversed = false;
  for (let i = 0; i < 30; i++) reversed ||= controller.think(ai, ctx).move < 0;
  assert.ok(reversed);
});

test('incoming bullets interrupt stuck recovery', () => {
  const { ai, controller, ctx } = fixture();
  ai.angle = Math.PI / 2;
  for (let i = 0; i < 30; i++) {
    if (controller.think(ai, ctx).move < 0) break;
  }
  ctx.bullets.push(incoming());
  assert.ok(controller.think(ai, ctx).fastTurn);
});

test('slow successful movement is not classified as stuck', () => {
  const { ai, target, controller, ctx } = fixture();
  for (let i = 0; i < 60; i++) {
    target.pos.x = ai.pos.x + 40;
    const intent = controller.think(ai, ctx);
    assert.equal(intent.move, -0.35);
    ai.moveForward(AI_THINK_DT, intent.move);
  }
});

test('own ricochet is detected after actual muzzle grace', () => {
  const { ai, controller, ctx } = fixture();
  ctx.bullets.push(incoming(270, ai, 0.2));
  assert.ok(controller.think(ai, ctx).fastTurn);
});

test('own bullet is predicted through the end of muzzle grace', () => {
  const { ai, controller, ctx } = fixture();
  ctx.bullets.push(incoming(270, ai, 0.1));
  assert.ok(controller.think(ai, ctx).fastTurn);
});

test('an outgoing own bullet during grace causes no false dodge', () => {
  const { ai, controller, ctx } = fixture();
  ctx.bullets.push(incoming(323, ai));
  assert.equal(controller.think(ai, ctx).fastTurn, false);
});

test('a bullet that expires before reaching the tank causes no dodge', () => {
  const { ai, controller, ctx } = fixture();
  ctx.bullets.push(incoming(200, null, 4.99));
  assert.equal(controller.think(ai, ctx).fastTurn, false);
});

test('a bullet that can hit just before expiry is still detected', () => {
  const { ai, controller, ctx } = fixture();
  ctx.bullets.push(incoming(276, null, 4.98));
  assert.ok(controller.think(ai, ctx).fastTurn);
});

test('bounce-limit prediction agrees with bullet physics', () => {
  for (const remaining of [0, 1]) {
    const { ai, controller, ctx } = fixture([{ x: 230, y: 200, w: 6, h: 200 }]);
    const b = incoming(270);
    b.vel.x *= -1;
    b.bounces = BULLET_MAX_BOUNCES - remaining;
    ctx.bullets.push(b);
    assert.equal(controller.think(ai, ctx).fastTurn, remaining === 1);
  }
});

test('wall-trapped dodge takes an available escape', () => {
  for (const side of [-1, 1]) {
    const { ai, board, ctx } = fixture([{ x: 200, y: side > 0 ? 323 : 271, w: 200, h: 6 }]);
    ai.angle = side * Math.PI / 2;
    const b = incoming(100);
    ctx.bullets.push(b);
    for (let i = 0; i < 120; i++) {
      ai.update(FIXED_DT, ctx);
      assert.notEqual(b.update(FIXED_DT, board, [ai]), ai, 'tank was hit while driving into the wall');
    }
  }
});

test('AI movement uses configured speed, scaling, multiplier and turn rate', () => {
  for (const scale of [1, 0.4]) {
    for (const multiplier of [1, 1.25, 1.5, 1.75, 2]) {
      const m = computeWorldMetrics(10, 10, 880 * scale, 880 * scale, multiplier);
      const board = new Board(10, 10, false, m, 1);
      const ai = new AutoPlayer(board, board.cellCenter(2, 2), 'AI', 'red', m);
      assert.equal(ai.speed, m.aiSpeed);
      assert.equal(ai.rotSpeed, AI_ROT_SPEED);
    }
  }
});

console.log(`${checks - failures}/${checks} AI regression checks passed`);
process.exitCode = failures ? 1 : 0;
