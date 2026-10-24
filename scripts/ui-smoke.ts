/**
 * DOM smoke test: exercise StartScreen → HUD → EndScreen wiring with jsdom.
 * Run with: npx tsx scripts/ui-smoke.ts
 */
import { JSDOM } from 'jsdom';
import type { MatchConfig } from '../src/types';
import { mulberry32 } from '../src/core/Board';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="overlays"></div><div id="hud-bar"></div><div id="hint-bar"></div></body></html>',
  { url: 'http://localhost/' },
);

// Expose the minimal DOM globals the UI modules touch.
(globalThis as Record<string, unknown>).document = dom.window.document;
(globalThis as Record<string, unknown>).window = dom.window;
(globalThis as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
(globalThis as Record<string, unknown>).HTMLInputElement = dom.window.HTMLInputElement;

// Import after globals are set.
const { StartScreen } = await import('../src/ui/StartScreen');
const { HUD } = await import('../src/ui/HUD');
const { EndScreen } = await import('../src/ui/EndScreen');
const { Game } = await import('../src/core/Game');

// Keep the simulated match and its timeout reproducible across runs.
Math.random = mulberry32(12345);

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
};

const overlays = dom.window.document.getElementById('overlays')!;

console.log('StartScreen');
let captured: MatchConfig | null = null;
new StartScreen(overlays, (cfg) => (captured = cfg));
{
  check('title renders', overlays.querySelector('h1')?.textContent === 'Tank Battle.');
  const badge = overlays.querySelector('.exp-badge');
  check(
    'Experimental badge renders',
    !!badge && badge.textContent === 'Experimental' && badge.classList.length > 0,
  );
  const controlSection = overlays.querySelector('#control-section')!;
  check('control section visible in PvE mode', !controlSection.classList.contains('hidden'));

  // Switch to FFA → control section hides.
  const ffaRadio = overlays.querySelector<HTMLInputElement>('input[name="mode"][value="ffa"]')!;
  ffaRadio.checked = true;
  ffaRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  check('control section hidden in FFA mode', controlSection.classList.contains('hidden'));

  // Fill the form and press START.
  (overlays.querySelector('#ai-count') as HTMLInputElement).value = '4';
  (overlays.querySelector('#board-width') as HTMLInputElement).value = '10';
  (overlays.querySelector('#board-height') as HTMLInputElement).value = '8';
  (overlays.querySelector('#fair') as HTMLInputElement).checked = true;
  (overlays.querySelector('#start-btn') as HTMLButtonElement).click();

  const cfg = captured as MatchConfig | null;
  check(
    'START emits the right config',
    !!cfg &&
      cfg.mode === 'ffa' &&
      cfg.aiCount === 4 &&
      cfg.width === 10 &&
      cfg.height === 8 &&
      cfg.fair === true &&
      cfg.speedMultiplier === 1,
    JSON.stringify(cfg),
  );

  // The Faster Movement slider: move it to max (2×) and restart.
  const slider = overlays.querySelector<HTMLInputElement>('#speed-slider')!;
  slider.value = '4';
  slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  check('slider readout updates', overlays.querySelector('#speed-readout')?.textContent === '2×');
  (overlays.querySelector('#start-btn') as HTMLButtonElement).click();
  const cfgFast = captured as MatchConfig | null;
  check('slider level flows into config', !!cfgFast && cfgFast.speedMultiplier === 2, JSON.stringify(cfgFast));

  // Random Size: hides the manual size inputs and randomizes on START.
  const sizeFields = Array.from(overlays.querySelectorAll<HTMLElement>('.size-field'));
  check('size inputs visible by default', sizeFields.every((f) => !f.classList.contains('hidden')));
  const randomCheck = overlays.querySelector<HTMLInputElement>('#random-size')!;
  randomCheck.checked = true;
  randomCheck.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  check('size inputs hidden when Random Size checked', sizeFields.every((f) => f.classList.contains('hidden')));
  (overlays.querySelector('#start-btn') as HTMLButtonElement).click();
  const cfgRandom = captured as MatchConfig | null;
  const tanksFor = (c: MatchConfig) => (c.mode === 'pve' ? 1 + c.aiCount : c.aiCount);
  check(
    'Random Size produces a valid board size',
    !!cfgRandom &&
      cfgRandom.width >= 5 &&
      cfgRandom.width <= 20 &&
      cfgRandom.height >= 5 &&
      cfgRandom.height <= 20 &&
      cfgRandom.width * cfgRandom.height >= tanksFor(cfgRandom) * 4,
    JSON.stringify(cfgRandom),
  );
  // Restore for the remaining flow: fixed 10×8 so the HUD assertions hold.
  randomCheck.checked = false;
  randomCheck.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  (overlays.querySelector('#board-width') as HTMLInputElement).value = '10';
  (overlays.querySelector('#board-height') as HTMLInputElement).value = '8';
  (overlays.querySelector('#start-btn') as HTMLButtonElement).click();
}

console.log('Game + HUD');
const game = new Game();
{
  const cfg = captured as MatchConfig | null;
  if (cfg) {
    game.start(cfg);
  } else {
    check('config captured before starting game', false);
  }
  if (cfg) {
    check('game starts playing', game.phase === 'playing' && game.totalCount === 4);

    const hud = new HUD(
      dom.window.document.getElementById('hud-bar')!,
      dom.window.document.getElementById('hint-bar')!,
      () => game.pause(),
      () => {},
    );
    hud.show('FFA', 'WASD move');
    hud.update(game.aliveCount, game.totalCount, '4 AI Free-for-All', 'WASD move');
    check(
      'HUD shows alive counts',
      dom.window.document.querySelector('#hud-alive')?.textContent === 'Alive: 4 / 4',
      dom.window.document.querySelector('#hud-alive')?.textContent ?? 'missing',
    );
    hud.setPaused(true);
    check('pause button toggles text', dom.window.document.querySelector('#hud-pause')?.textContent === 'Resume');

    // Run the match to completion, then show the end screen.
    let t = 0;
    while (game.phase === 'playing' && t < 60) {
      game.update(1 / 120);
      t += 1 / 120;
    }
    const endScreen = new EndScreen(overlays, () => {}, () => {});
    endScreen.show(game);
    check('match reached an outcome', game.phase === 'over', `phase=${game.phase} alive=${game.aliveCount}`);
    check(
      'end screen announces the outcome',
      /WINS|DRAW/.test(overlays.querySelector('#end-title')?.textContent ?? ''),
      overlays.querySelector('#end-title')?.textContent ?? 'none',
    );
  }
}

console.log('StartScreen — First-to-x');
{
  const firstToXRadio = overlays.querySelector<HTMLInputElement>('input[name="mode"][value="first-to-x"]')!;
  firstToXRadio.checked = true;
  firstToXRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  const controlSection = overlays.querySelector('#control-section')!;
  check('first-to-x keeps control mode visible', !controlSection.classList.contains('hidden'));
  check('first-to-x hides AI count', overlays.querySelector('#ai-count-field')!.classList.contains('hidden'));
  check('first-to-x shows First-to input', !overlays.querySelector('#first-to-field')!.classList.contains('hidden'));
  const sizeFields = Array.from(overlays.querySelectorAll<HTMLElement>('.size-field'));
  check('first-to-x hides size inputs', sizeFields.every((f) => f.classList.contains('hidden')));
  check('first-to-x hides Random Size row', overlays.querySelector('#random-size-row')!.classList.contains('hidden'));

  (overlays.querySelector('#first-to') as HTMLInputElement).value = '7';
  (overlays.querySelector('#start-btn') as HTMLButtonElement).click();
  const cfgTour = captured as MatchConfig | null;
  check(
    'START emits first-to-x config (aiCount 1, targetScore 7)',
    !!cfgTour &&
      cfgTour.mode === 'first-to-x' &&
      cfgTour.aiCount === 1 &&
      cfgTour.targetScore === 7 &&
      cfgTour.width >= 5 &&
      cfgTour.height >= 5,
    JSON.stringify(cfgTour),
  );

  // HUD scoreboard reflects first-to-x colors and the target.
  const score = dom.window.document.querySelector<HTMLElement>('#ts-player')!;
  check('scoreboard uses player/AI colors', !!score && score.style.color !== '');
}

console.log('');
if (failures === 0) {
  console.log('ALL UI SMOKE CHECKS PASSED ✅');
  process.exit(0);
} else {
  console.error(`${failures} UI SMOKE CHECKS FAILED ❌`);
  process.exit(1);
}
