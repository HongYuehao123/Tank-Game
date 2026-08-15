import { Board } from './Board';
import { computeWorldMetrics, type WorldMetrics } from './metrics';
import { Tank } from '../entities/Tank';
import { Player } from '../entities/Player';
import { AutoPlayer } from '../entities/AutoPlayer';
import { Bullet } from '../entities/Bullet';
import { FIXED_DT, AI_COLORS, PALETTE, TOURNAMENT_AI_COLOR } from '../config';
import type { InputState, MatchConfig, Phase } from '../types';
import type { AIContext } from '../ai/Controller';

export class Game {
  board: Board | null = null;
  config!: MatchConfig;
  metrics!: WorldMetrics;
  tanks: Tank[] = [];
  bullets: Bullet[] = [];
  phase: Phase = 'idle';
  winner: Tank | null = null;
  player: Player | null = null;
  time = 0;

  input: InputState = { keys: {}, mouse: { x: 0, y: 0 }, shoot: false };

  private accumulator = 0;
  private justEnded = false;

  get aliveCount(): number {
    return this.tanks.reduce((n, t) => n + (t.alive ? 1 : 0), 0);
  }

  get totalCount(): number {
    return this.tanks.length;
  }

  start(
    config: MatchConfig,
    metrics: WorldMetrics = computeWorldMetrics(config.width, config.height, 1e9, 1e9, config.speedMultiplier),
  ): void {
    this.config = config;
    this.metrics = metrics;
    this.board = new Board(config.width, config.height, config.fair, metrics);
    this.tanks = [];
    this.bullets = [];
    this.winner = null;
    this.time = 0;
    this.accumulator = 0;
    this.justEnded = false;
    this.input = { keys: {}, mouse: { x: 0, y: 0 }, shoot: false };

    // First-to-x is a fixed 1v1: the human player plus exactly one AutoPlayer.
    const isPlayerMode = config.mode === 'pve' || config.mode === 'first-to-x';
    const aiCount = config.mode === 'first-to-x' ? 1 : config.aiCount;
    const tankCount = isPlayerMode ? 1 + aiCount : config.aiCount;
    const spawns = this.board.pickSpawns(tankCount, isPlayerMode);

    let idx = 0;
    if (isPlayerMode) {
      this.player = new Player(this.board, spawns[0], 'You', PALETTE.player, metrics);
      this.player.controlMode = config.controlMode;
      this.player.input = this.input;
      this.tanks.push(this.player);
      idx = 1;
    } else {
      this.player = null;
    }

    for (let i = idx; i < spawns.length; i++) {
      const name = config.mode === 'first-to-x' ? 'AI' : isPlayerMode ? `AI ${i}` : `AI ${i + 1}`;
      const color =
        config.mode === 'first-to-x' ? TOURNAMENT_AI_COLOR : AI_COLORS[(i - idx) % AI_COLORS.length];
      this.tanks.push(new AutoPlayer(this.board, spawns[i], name, color, metrics));
    }

    this.phase = 'playing';
  }

  /** Advance the simulation; returns true if the match just ended this frame. */
  update(dt: number): boolean {
    if (this.phase !== 'playing') return false;
    this.time += dt;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 10) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    const ended = this.justEnded;
    this.justEnded = false;
    return ended;
  }

  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  private step(dt: number): void {
    const ctx: AIContext = { tanks: this.tanks, bullets: this.bullets, board: this.board! };

    for (const t of this.tanks) {
      if (!t.alive) continue;
      if (t instanceof AutoPlayer) {
        (t as AutoPlayer).update(dt, ctx);
      } else {
        t.update(dt);
      }
      if (t.fired.length > 0) {
        this.bullets.push(...t.fired);
        t.fired.length = 0;
      }
    }

    for (const b of [...this.bullets]) {
      if (b.dead) continue;
      const hit = b.update(dt, this.board!, this.tanks);
      if (hit) {
        hit.alive = false;
        b.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    const alive = this.tanks.filter((t) => t.alive);
    if (alive.length <= 1) {
      this.phase = 'over';
      this.winner = alive[0] ?? null;
      this.justEnded = true;
    }
  }

  /** Clear the match and return to the pre-game idle state (menu). */
  resetToIdle(): void {
    this.phase = 'idle';
    this.tanks = [];
    this.bullets = [];
    this.winner = null;
    this.player = null;
    this.board = null;
    this.time = 0;
    this.accumulator = 0;
    this.justEnded = false;
  }
}
