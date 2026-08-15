/**
 * Headless smoke test for the core game logic (no DOM needed).
 * Run with: npm run smoke
 */
import { Board } from '../src/core/Board';
import { computeWorldMetrics } from '../src/core/metrics';
import { Game } from '../src/core/Game';
import { TournamentSession } from '../src/core/Tournament';
import { Tank } from '../src/entities/Tank';
import { Bullet } from '../src/entities/Bullet';
import { Player } from '../src/entities/Player';
import { AutoPlayer } from '../src/entities/AutoPlayer';
import { movePointWithBounces, bulletHitsTank } from '../src/core/Collision';
import { vec2 } from '../src/math/Vec2';
import { FIXED_DT, BASE_CELL, TANK_WID, TANK_LEN, BULLET_SPEED, TOURNAMENT_AI_COLOR } from '../src/config';

// Base-size world (huge viewport → scale 1) for deterministic geometry tests.
const METRICS = computeWorldMetrics(20, 20, 100000, 100000);

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = ''): void {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

function runVirtualMatch(game: Game, seconds: number): void {
  let remaining = seconds;
  const dt = FIXED_DT;
  while (remaining > 0 && game.phase === 'playing') {
    game.update(dt);
    remaining -= dt;
  }
}

function cfg(over: Partial<Parameters<Game['start']>[0]>): Parameters<Game['start']>[0] {
  return {
    mode: 'ffa',
    aiCount: 3,
    controlMode: 'classic',
    width: 8,
    height: 8,
    fair: false,
    speedMultiplier: 1,
    ...over,
  };
}

function cellReachability(b: Board): Set<number> {
  const visited = new Set<number>([0]);
  const q = [{ r: 0, c: 0 }];
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of b.openNeighbors(cur.r, cur.c)) {
      const key = nb.r * b.width + nb.c;
      if (!visited.has(key)) {
        visited.add(key);
        q.push(nb);
      }
    }
  }
  return visited;
}

console.log('Board generation');
{
  const b = new Board(12, 8, false, METRICS, 12345);
  check('12x8 unfair board has wall segments', b.walls.length > 0);
  check(
    'border segments are wall',
    b.hWallAt(0, 0) &&
      b.hWallAt(b.height, b.width - 1) &&
      b.vWallAt(0, 0) &&
      b.vWallAt(b.height - 1, b.width),
  );
  check(
    'cell ≥ 4× tank width and ≥ 2× tank length',
    b.cell >= 4 * TANK_WID && b.cell >= 2 * TANK_LEN,
    `cell=${b.cell} (base ${BASE_CELL})`,
  );
  check(
    'walls are thin segments, not blocks',
    b.walls.every((w) => Math.min(w.w, w.h) <= METRICS.wallThickness + 0.001),
  );
  const spawns = b.pickSpawns(4, true);
  check('spawns distinct & in bounds', spawns.length === 4 && spawns.every((s) => b.isOpen(Math.floor(s.y / b.cell), Math.floor(s.x / b.cell))));
  const reached = cellReachability(b);
  check('all cells connected through wall gaps', reached.size === b.width * b.height, `${reached.size}/${b.width * b.height}`);
}

{
  const b = new Board(5, 20, true, METRICS, 999);
  let symH = true;
  let symV = true;
  for (let r = 0; r <= b.height; r++) {
    for (let c = 0; c < b.width; c++) {
      if (b.hWallAt(r, c) !== b.hWallAt(r, b.width - 1 - c)) symH = false;
    }
  }
  for (let r = 0; r < b.height; r++) {
    for (let c = 0; c <= b.width; c++) {
      if (b.vWallAt(r, c) !== b.vWallAt(r, b.width - c)) symV = false;
    }
  }
  check('fair 5x20 board is left-right symmetric', symH && symV);
}

console.log('Bullet physics');
{
  const b = new Board(8, 8, false, METRICS, 1);
  // Fire right from the rightmost column straight at the border wall.
  const r = 4;
  const p0 = b.cellCenter(r, b.width - 1);
  const v = vec2(METRICS.bulletSpeed, 0);
  const gap = b.width * b.cell - METRICS.wallThickness / 2 - METRICS.bulletRadius - p0.x;
  const dt = gap / METRICS.bulletSpeed + 0.08;
  const res = movePointWithBounces(p0, v, dt, b, METRICS.bulletRadius);
  check('bullet bounces off wall (vx flips)', res.vel.x < 0, `vx=${res.vel.x.toFixed(1)}`);
  check('bullet bounced exactly once', res.bounces === 1, `bounces=${res.bounces}`);
}

console.log('Uniform bullets — self-kill is possible');
{
  const b = new Board(6, 6, false, METRICS, 7);
  const tank = new Tank(b, b.cellCenter(2, 2), 'Self', '#fff', METRICS);
  tank.angle = 0;
  // Bullet owned by the tank, just outside its own hitbox, heading straight back.
  const bullet = new Bullet(
    vec2(tank.pos.x + 21, tank.pos.y),
    vec2(-METRICS.bulletSpeed, 0),
    tank,
    METRICS.bulletRadius,
  );
  let hit: Tank | null = null;
  // Run past the muzzle-grace window (0.12s) so the ricochet self-kill can land.
  for (let i = 0; i < 30 && !bullet.dead; i++) {
    hit = bullet.update(FIXED_DT, b, [tank]);
    if (hit) {
      hit.alive = false; // the Game does this; replicate it here
      break;
    }
  }
  check('bullet can kill its own owner', hit === tank && !tank.alive, hit ? `hit=${hit.name}` : 'no hit');
}

console.log('Hitbox is directional (turning changes profile)');
{
  const b = new Board(6, 6, false, METRICS, 7);
  const tank = new Tank(b, b.cellCenter(2, 2), 'T', '#fff', METRICS);
  const br = METRICS.bulletRadius;
  const offset = vec2(20, 0); // 20px to the right of center
  tank.angle = 0; // facing right → side profile exposed: 20 < len/2+5=22 → hit
  const frontHit = bulletHitsTank(tank.pos.x + offset.x, tank.pos.y + offset.y, br, tank);
  tank.angle = Math.PI / 2; // facing up → only wid/2+5=16 reach → no hit
  const sideHit = bulletHitsTank(tank.pos.x + offset.x, tank.pos.y + offset.y, br, tank);
  check('hitbox is an ellipse (orientation matters)', frontHit && !sideHit, `front=${frontHit} side=${sideHit}`);
}

console.log('Full matches');
{
  const g = new Game();
  g.start(cfg({ aiCount: 4, width: 10, height: 10 }));
  runVirtualMatch(g, 90);
  check('FFA (4 AI, 10x10) reaches a winner', g.phase === 'over' && g.winner !== null, `phase=${g.phase} alive=${g.aliveCount}`);
}

{
  const g = new Game();
  g.start(cfg({ mode: 'pve', aiCount: 3, fair: true }));
  // Player stands still (keys all false) — AIs battle it out.
  runVirtualMatch(g, 90);
  check('PvE (3 AI, fair 8x8) completes without crash', g.phase === 'over', `phase=${g.phase} alive=${g.aliveCount}`);
}

{
  // Sanity: a large unfair 20x20 FFA runs without blowing up.
  const g = new Game();
  g.start(cfg({ aiCount: 8, width: 20, height: 20 }));
  runVirtualMatch(g, 30);
  check('20x20 FFA runs 30s without crash', true, `alive=${g.aliveCount} phase=${g.phase}`);
}

{
  // Modern-mode player update path (rotation clamp) must not throw.
  const g = new Game();
  g.start(cfg({ mode: 'pve', aiCount: 2, controlMode: 'modern', width: 6, height: 6 }));
  const player = g.player as Player;
  player.input = { keys: { KeyW: true, KeyD: true }, mouse: { x: 10, y: 10 }, shoot: true };
  for (let i = 0; i < 300; i++) {
    g.update(FIXED_DT);
  }
  const inBounds =
    player.pos.x > 0 && player.pos.x < g.board!.canvasW && player.pos.y > 0 && player.pos.y < g.board!.canvasH;
  check('modern mode player stays in bounds', inBounds, `pos=(${player.pos.x.toFixed(0)},${player.pos.y.toFixed(0)})`);
}

{
  // AutoPlayer.update with context produces sane intents without throwing.
  const g = new Game();
  g.start(cfg({ aiCount: 3, width: 7, height: 7 }));
  const ai = g.tanks.find((t) => t instanceof AutoPlayer) as AutoPlayer;
  ai.update(FIXED_DT, { tanks: g.tanks, bullets: g.bullets, board: g.board! });
  check('AutoPlayer update with context runs', ai.alive);
}

console.log('First-to-x mode');
{
  const g = new Game();
  g.start(cfg({ mode: 'first-to-x', aiCount: 1, targetScore: 5, width: 8, height: 8 }));
  const ai = g.tanks.find((t) => t instanceof AutoPlayer) as AutoPlayer;
  check('first-to-x spawns player + exactly 1 AI', g.totalCount === 2 && g.player !== null && !!ai);
  check('first-to-x AI uses the fixed color', ai.color === TOURNAMENT_AI_COLOR, ai.color);
  runVirtualMatch(g, 90);
  check('first-to-x round reaches a winner', g.phase === 'over' && g.winner !== null, `phase=${g.phase} alive=${g.aliveCount}`);
}

{
  const s = new TournamentSession(3);
  s.record('player');
  s.record('ai');
  s.record('player');
  s.record(null); // draw — ignored
  check('first-to-x score tallies and ignores draws', s.player === 2 && s.ai === 1, `You ${s.player} – AI ${s.ai}`);
  check('series not over before target', !s.isOver && s.champion === null);
  s.record('player');
  check('series ends at first-to and names champion', s.isOver && s.champion === 'player', `You ${s.player} – AI ${s.ai}`);
}

console.log('Fit-to-screen scaling');
{
  const small = computeWorldMetrics(12, 12, 500, 400);
  check('world shrinks to fit a small viewport', small.scale < 1 && small.cell < BASE_CELL, `scale=${small.scale.toFixed(2)}`);
  check('cell/tank ratio preserved when scaled', small.cell >= 4 * small.tankWid && small.cell >= 2 * small.tankLen);
  const g = new Game();
  g.start(cfg({ aiCount: 3, width: 12, height: 12 }), small);
  check('scaled board fits the viewport', g.board!.canvasW <= 500 + 0.01 && g.board!.canvasH <= 400 + 0.01,
    `${g.board!.canvasW.toFixed(0)}x${g.board!.canvasH.toFixed(0)}`);
  runVirtualMatch(g, 60);
  check('scaled 12x12 FFA completes', g.phase === 'over', `phase=${g.phase} alive=${g.aliveCount}`);
}

console.log('Speed multiplier');
{
  const m1 = computeWorldMetrics(10, 10, 100000, 100000, 1);
  const m2 = computeWorldMetrics(10, 10, 100000, 100000, 2);
  const m125 = computeWorldMetrics(10, 10, 100000, 100000, 1.25);
  check(
    '2× multiplier doubles tank speed',
    Math.abs(m2.tankSpeed - 2 * m1.tankSpeed) < 1e-6 && Math.abs(m2.aiSpeed - 2 * m1.aiSpeed) < 1e-6,
    `tank ${m1.tankSpeed.toFixed(1)} → ${m2.tankSpeed.toFixed(1)}`,
  );
  check(
    '1.25× multiplier scales proportionally',
    Math.abs(m125.tankSpeed - 1.25 * m1.tankSpeed) < 1e-6,
  );
  check(
    'bullet speed scales with the multiplier too',
    Math.abs(m2.bulletSpeed - 2 * m1.bulletSpeed) < 1e-6 &&
      Math.abs(m1.bulletSpeed - BULLET_SPEED) < 1e-6,
    `${m1.bulletSpeed.toFixed(1)} → ${m2.bulletSpeed.toFixed(1)}`,
  );
  const gSlow = new Game();
  gSlow.start(cfg({ mode: 'pve', aiCount: 3 }), computeWorldMetrics(8, 8, 100000, 100000, 1));
  const gFast = new Game();
  gFast.start(cfg({ mode: 'pve', aiCount: 3 }), computeWorldMetrics(8, 8, 100000, 100000, 2));
  const pSlow = gSlow.player as Player;
  const pFast = gFast.player as Player;
  check('2× config speeds up the player tank in-game', pFast.speed > 1.9 * pSlow.speed, `${pSlow.speed.toFixed(1)} → ${pFast.speed.toFixed(1)}`);
}

console.log('');
if (failures === 0) {
  console.log(`ALL ${checks} SMOKE CHECKS PASSED ✅`);
  process.exit(0);
} else {
  console.error(`${failures}/${checks} SMOKE CHECKS FAILED ❌`);
  process.exit(1);
}
