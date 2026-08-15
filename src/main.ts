import './style.css';
import { Game } from './core/Game';
import { computeWorldMetrics, type WorldMetrics } from './core/metrics';
import { randomBoardSize } from './core/Board';
import { TournamentSession } from './core/Tournament';
import { Renderer } from './render/Renderer';
import { StartScreen } from './ui/StartScreen';
import { HUD } from './ui/HUD';
import { EndScreen } from './ui/EndScreen';
import { DEFAULT_FIRST_TO } from './config';
import type { MatchConfig } from './types';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const overlays = document.getElementById('overlays')!;
const hudBar = document.getElementById('hud-bar')!;
const hintBar = document.getElementById('hint-bar')!;

/** Default canvas size, matching the initial HTML attributes. Used whenever a
 *  full-screen overlay (menu / end screen) is shown, so a small board can't
 *  shrink the container and squeeze the menu. */
const DEFAULT_CANVAS = 720;

const game = new Game();
const renderer = new Renderer(ctx);

let lastConfig: MatchConfig | null = null;

/* First-to-x series state — lives here (not in Game) so it survives the
 * per-round Game restarts. */
let tournamentBase: MatchConfig | null = null;
let tournamentSession: TournamentSession | null = null;
let nextRoundTimer: number | undefined;

/** Blocks are big by default; shrink the whole world (map + tanks) to fit.
 *  The HUD bar above and hint bar below the board are not overlays anymore,
 *  so their height is reserved and the board must fit in what's left. */
function metricsFor(cfg: MatchConfig): WorldMetrics {
  const availW = window.innerWidth - 32;
  const availH = window.innerHeight - 128;
  return computeWorldMetrics(cfg.width, cfg.height, availW, availH, cfg.speedMultiplier);
}

function sizeCanvas(): void {
  if (!game.board) return;
  canvas.width = game.board.canvasW;
  canvas.height = game.board.canvasH;
}

/** Reset the canvas to the default size when returning to the main menu. */
function defaultCanvas(): void {
  canvas.width = DEFAULT_CANVAS;
  canvas.height = DEFAULT_CANVAS;
}

function modeLabelFor(cfg: MatchConfig): string {
  if (cfg.mode === 'first-to-x') {
    return `First-to-x · ${cfg.width}×${cfg.height} · ${speedLabel(cfg.speedMultiplier)}`;
  }
  const base = cfg.mode === 'pve' ? `Player vs ${cfg.aiCount} AI` : `${cfg.aiCount} AI Free-for-All`;
  return `${base} · ${cfg.width}×${cfg.height} · ${speedLabel(cfg.speedMultiplier)}`;
}

function speedLabel(m: number): string {
  return `${m}×`;
}

function hintFor(cfg: MatchConfig): string {
  return cfg.controlMode === 'classic'
    ? 'W/S drive · A/D turn · Space shoot'
    : 'WASD move · Mouse aim · Click/Space shoot';
}

/* ---------- input ---------- */

const onKeyDown = (e: KeyboardEvent) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  game.input.keys[e.code] = true;
  if (e.code === 'Space') game.input.shoot = true;
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
};

const onKeyUp = (e: KeyboardEvent) => {
  game.input.keys[e.code] = false;
};

const onMouseMove = (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  game.input.mouse.x = (e.clientX - rect.left) * sx;
  game.input.mouse.y = (e.clientY - rect.top) * sy;
};

const onMouseDown = (e: MouseEvent) => {
  if (e.button === 0) game.input.shoot = true;
};

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mousedown', onMouseDown);

function togglePause(): void {
  if (game.phase === 'playing') {
    game.pause();
    hud.setPaused(true);
  } else if (game.phase === 'paused') {
    game.resume();
    hud.setPaused(false);
  }
}

/* ---------- UI wiring ---------- */

function startMatch(cfg: MatchConfig): void {
  lastConfig = cfg;
  game.start(cfg, metricsFor(cfg));
  sizeCanvas();
  startScreen.hide();
  endScreen.hide();
  hud.setPaused(false);
  hud.show(modeLabelFor(cfg), hintFor(cfg));
}

function clearNextRoundTimer(): void {
  if (nextRoundTimer !== undefined) {
    window.clearTimeout(nextRoundTimer);
    nextRoundTimer = undefined;
  }
}

function startTournament(cfg: MatchConfig): void {
  tournamentBase = cfg;
  tournamentSession = new TournamentSession(cfg.targetScore ?? DEFAULT_FIRST_TO);
  clearNextRoundTimer();
  playNextRound();
}

/** Start the next round on a freshly randomized board + size. */
function playNextRound(): void {
  if (!tournamentBase || !tournamentSession) return;
  const size = randomBoardSize(2 * 4); // player + one AI need ≥ 8 cells
  const roundCfg: MatchConfig = {
    ...tournamentBase,
    width: size.w,
    height: size.h,
    aiCount: 1,
    targetScore: tournamentSession.target,
  };
  lastConfig = roundCfg;
  endScreen.hide();
  startMatch(roundCfg);
  hud.setScore(tournamentSession.player, tournamentSession.ai, tournamentSession.target);
}

/** Called when a first-to-x round ends: update the score, then either end the
 *  series or auto-start the next round after a short pause. */
function onTournamentRoundEnd(): void {
  if (!tournamentSession) return;
  const winner = game.winner;
  const result: 'player' | 'ai' | 'draw' = !winner ? 'draw' : winner.isPlayer ? 'player' : 'ai';
  if (result !== 'draw') tournamentSession.record(result);
  hud.setScore(tournamentSession.player, tournamentSession.ai, tournamentSession.target);

  if (tournamentSession.isOver) {
    clearNextRoundTimer();
    hud.hide();
    hud.hideScore();
    endScreen.showFinal(
      tournamentSession.champion!,
      tournamentSession.player,
      tournamentSession.ai,
      tournamentSession.target,
    );
  } else {
    endScreen.showRoundResult(result, tournamentSession.player, tournamentSession.ai, tournamentSession.target);
    clearNextRoundTimer();
    nextRoundTimer = window.setTimeout(() => {
      nextRoundTimer = undefined;
      playNextRound();
    }, 1800);
  }
}

function goToMenu(): void {
  clearNextRoundTimer();
  tournamentBase = null;
  tournamentSession = null;
  endScreen.hide();
  hud.hide();
  hud.hideScore();
  game.resetToIdle();
  defaultCanvas();
  startScreen.show();
}

const startScreen = new StartScreen(overlays, (cfg) => {
  if (cfg.mode === 'first-to-x') startTournament(cfg);
  else startMatch(cfg);
});

const hud = new HUD(
  hudBar,
  hintBar,
  togglePause,
  () => {
    if (lastConfig) startMatch(lastConfig);
  },
);

const endScreen = new EndScreen(
  overlays,
  () => {
    if (lastConfig?.mode === 'first-to-x') {
      if (tournamentBase) startTournament(tournamentBase);
    } else if (lastConfig) {
      startMatch(lastConfig);
    }
  },
  goToMenu,
);

/* ---------- main loop ---------- */

// Refit the board when the window resizes: restart the current match at the
// freshly computed scale (only when the fit actually changed). Skip while idle
// or once a match is over (including the between-round first-to-x pause).
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!lastConfig || game.phase === 'idle' || game.phase === 'over') return;
    const next = metricsFor(lastConfig);
    if (Math.abs(next.scale - game.metrics.scale) > 0.02) {
      startMatch(lastConfig);
    }
  }, 250);
});

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (game.phase === 'playing') {
    const ended = game.update(dt);
    if (ended) {
      if (game.config.mode === 'first-to-x') {
        onTournamentRoundEnd();
      } else {
        hud.hide();
        endScreen.show(game);
      }
    } else {
      hud.update(game.aliveCount, game.totalCount, modeLabelFor(game.config), hintFor(game.config));
    }
  }

  renderer.render(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
