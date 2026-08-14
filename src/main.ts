import './style.css';
import { Game } from './core/Game';
import { computeWorldMetrics, type WorldMetrics } from './core/metrics';
import { Renderer } from './render/Renderer';
import { StartScreen } from './ui/StartScreen';
import { HUD } from './ui/HUD';
import { EndScreen } from './ui/EndScreen';
import type { MatchConfig } from './types';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const overlays = document.getElementById('overlays')!;

const game = new Game();
const renderer = new Renderer(ctx);

let lastConfig: MatchConfig | null = null;

/** Blocks are big by default; shrink the whole world (map + tanks) to fit. */
function metricsFor(cfg: MatchConfig): WorldMetrics {
  const availW = window.innerWidth - 32;
  const availH = window.innerHeight - 32;
  return computeWorldMetrics(cfg.width, cfg.height, availW, availH, cfg.speedMultiplier);
}

function sizeCanvas(): void {
  if (!game.board) return;
  canvas.width = game.board.canvasW;
  canvas.height = game.board.canvasH;
}

function modeLabelFor(cfg: MatchConfig): string {
  const base = cfg.mode === 'pve' ? `Player vs ${cfg.aiCount} AI` : `${cfg.aiCount} AI Free-for-All`;
  return `${base} · ${cfg.width}×${cfg.height} · ${speedLabel(cfg.speedMultiplier)}`;
}

function speedLabel(m: number): string {
  if (m === 1) return '1×';
  if (m === 2) return '2×';
  return `×${(Math.round(m * 100) / 100).toFixed(2)}`;
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

const startScreen = new StartScreen(overlays, startMatch);

const hud = new HUD(
  overlays,
  togglePause,
  () => {
    if (lastConfig) startMatch(lastConfig);
  },
);

const endScreen = new EndScreen(
  overlays,
  () => {
    if (lastConfig) startMatch(lastConfig);
  },
  () => {
    endScreen.hide();
    hud.hide();
    startScreen.show();
  },
);

/* ---------- main loop ---------- */

// Refit the board when the window resizes: restart the current match at the
// freshly computed scale (only when the fit actually changed).
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!lastConfig || game.phase === 'idle') return;
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
      hud.hide();
      endScreen.show(game);
    } else {
      hud.update(game.aliveCount, game.totalCount, modeLabelFor(game.config), hintFor(game.config));
    }
  }

  renderer.render(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
