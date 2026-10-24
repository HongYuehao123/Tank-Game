import type { ControlMode, GameMode, MatchConfig } from '../types';
import { MIN_BOARD, MAX_BOARD, MIN_FIRST_TO, DEFAULT_FIRST_TO } from '../config';
import { randomBoardSize } from '../core/Board';

/**
 * Starting page: game mode, AI count (or first-to-x target), board size,
 * control mode (PvE/first-to-x only), and the Fair Generation checkbox.
 */
export class StartScreen {
  private el: HTMLElement;
  private modeRadios: HTMLInputElement[];
  private controlRadios: HTMLInputElement[];
  private controlSection: HTMLElement;
  private aiCountField: HTMLElement;
  private aiInput: HTMLInputElement;
  private firstToField: HTMLElement;
  private firstToInput: HTMLInputElement;
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private fairCheck: HTMLInputElement;
  private randomCheck: HTMLInputElement;
  private randomSizeRow: HTMLElement;
  private sizeFields: HTMLElement[];
  private speedSlider: HTMLInputElement;
  private speedReadout: HTMLElement;
  private errorEl: HTMLElement;
  private onStartCb: (cfg: MatchConfig) => void;

  private static readonly SPEED_LEVELS = [1, 1.25, 1.5, 1.75, 2];
  private static readonly SPEED_LABELS = ['1×', '1.25×', '1.5×', '1.75×', '2×'];

  constructor(container: HTMLElement, onStart: (cfg: MatchConfig) => void) {
    this.onStartCb = onStart;
    this.el = document.createElement('div');
    this.el.className = 'overlay';
    this.el.innerHTML = `
      <div class="card start-card">
        <div class="start-intro">
          <p class="eyebrow">A little time for play</p>
          <h1>Tank <span>Battle.</span></h1>
          <p class="subtitle">A familiar arena. A smarter opponent.<br />Be the last tank standing.</p>
          <div class="arena-art" aria-hidden="true">
            <svg viewBox="0 0 320 300" focusable="false">
              <g class="art-rings" fill="none" stroke-width="1">
                <circle cx="160" cy="150" r="110" />
                <circle cx="160" cy="150" r="78" />
                <circle cx="160" cy="150" r="46" />
              </g>
              <path class="art-path" d="M44 236 L260 236 L260 62 L218 62" fill="none" stroke-width="2" stroke-dasharray="4 7" />
              <g class="art-tank" transform="translate(151 153) rotate(-32)">
                <rect x="-49" y="-40" width="98" height="18" rx="4" />
                <rect x="-49" y="22" width="98" height="18" rx="4" />
                <rect x="-42" y="-31" width="84" height="62" rx="6" />
                <rect x="-2" y="-7" width="82" height="14" rx="2" />
                <circle class="art-turret" r="20" />
                <circle class="art-detail" r="6" />
              </g>
              <circle class="art-projectile" cx="221" cy="62" r="6" />
              <path class="art-spark" d="M65 70 V86 M57 78 H73" fill="none" stroke-width="2" />
            </svg>
            <span class="art-caption">Move. Aim. Outlast.</span>
          </div>
          <p class="start-note">One hit. One winner. Mind the ricochets.</p>
        </div>
        <div class="start-settings">
          <p class="eyebrow">Your next match</p>
          <h2>Set the arena.</h2>
          <div class="field">
            <span class="field-label">Game Mode</span>
            <div class="mode-grid" role="radiogroup" aria-label="Game Mode">
              <label class="mode-card selected">
                <input type="radio" name="mode" value="pve" checked />
                <span class="mode-title">Player vs AutoPlayers</span>
                <span class="mode-desc">You vs a chosen number of AI tanks</span>
              </label>
              <label class="mode-card">
                <input type="radio" name="mode" value="ffa" />
                <span class="mode-title">AutoPlayers vs AutoPlayers</span>
                <span class="mode-desc">AI-only free-for-all, watch it play</span>
              </label>
              <label class="mode-card">
                <input type="radio" name="mode" value="first-to-x" />
                <span class="mode-title">First-to-x</span>
                <span class="mode-desc">1v1 vs one AI, first to a score</span>
              </label>
            </div>
          </div>

          <div class="row">
            <div class="field" id="ai-count-field">
              <label for="ai-count">${'AI Count'}</label>
              <input id="ai-count" type="number" min="1" max="19" value="3" />
            </div>
            <div class="field" id="first-to-field">
              <label for="first-to">First to</label>
              <input id="first-to" type="number" min="${MIN_FIRST_TO}" value="${DEFAULT_FIRST_TO}" />
            </div>
            <div class="field size-field">
              <label for="board-width">Board Width (5–${MAX_BOARD})</label>
              <input id="board-width" type="number" min="${MIN_BOARD}" max="${MAX_BOARD}" value="12" />
            </div>
            <div class="field size-field">
              <label for="board-height">Board Height (5–${MAX_BOARD})</label>
              <input id="board-height" type="number" min="${MIN_BOARD}" max="${MAX_BOARD}" value="12" />
            </div>
          </div>

          <div class="fair-row" id="random-size-row">
            <input id="random-size" type="checkbox" />
            <label for="random-size">Random Size</label>
          </div>

          <div class="field">
            <label class="field-label" for="speed-slider">Faster Movement</label>
            <div class="speed-row">
              <input id="speed-slider" type="range" min="0" max="4" step="1" value="0" />
              <span class="speed-readout" id="speed-readout">1×</span>
            </div>
            <div class="speed-labels">
              <span>1×</span><span>1.25×</span><span>1.5×</span><span>1.75×</span><span>2×</span>
            </div>
          </div>

          <div class="field" id="control-section">
            <span class="field-label">Control Mode</span>
            <div class="segmented">
              <label class="selected">
                <input type="radio" name="control" value="classic" checked />
                Classic (Robot Centered)
              </label>
              <label>
                <input type="radio" name="control" value="modern" />
                Modern (Field Centered)
              </label>
            </div>
          </div>

          <div class="fair-row">
            <input id="fair" type="checkbox" />
            <label for="fair">Fair Generation<span class="exp-badge">Experimental</span></label>
          </div>

          <p class="error-msg" id="start-error" role="alert"></p>
          <button class="btn-primary" id="start-btn">START</button>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.modeRadios = Array.from(this.el.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
    this.controlRadios = Array.from(this.el.querySelectorAll<HTMLInputElement>('input[name="control"]'));
    this.controlSection = this.el.querySelector('#control-section')!;
    this.aiCountField = this.el.querySelector('#ai-count-field')!;
    this.aiInput = this.el.querySelector('#ai-count')!;
    this.firstToField = this.el.querySelector('#first-to-field')!;
    this.firstToInput = this.el.querySelector('#first-to')!;
    this.widthInput = this.el.querySelector('#board-width')!;
    this.heightInput = this.el.querySelector('#board-height')!;
    this.fairCheck = this.el.querySelector('#fair')!;
    this.randomCheck = this.el.querySelector('#random-size')!;
    this.randomSizeRow = this.el.querySelector('#random-size-row')!;
    this.sizeFields = Array.from(this.el.querySelectorAll<HTMLElement>('.size-field'));
    this.speedSlider = this.el.querySelector('#speed-slider')!;
    this.speedReadout = this.el.querySelector('#speed-readout')!;
    this.errorEl = this.el.querySelector('#start-error')!;

    this.randomCheck.addEventListener('change', () => this.updateSizeFields());
    this.updateSizeFields();

    this.speedSlider.addEventListener('input', () => {
      const i = Math.min(parseInt(this.speedSlider.value, 10), StartScreen.SPEED_LABELS.length - 1);
      this.speedReadout.textContent = StartScreen.SPEED_LABELS[i];
    });

    const cards = Array.from(this.el.querySelectorAll<HTMLElement>('.mode-card'));
    for (const [i, radio] of this.modeRadios.entries()) {
      radio.addEventListener('change', () => {
        cards.forEach((c, j) => c.classList.toggle('selected', i === j));
        this.updateMode();
      });
    }
    const segments = Array.from(this.el.querySelectorAll<HTMLElement>('.segmented label'));
    this.controlRadios.forEach((radio, i) => {
      radio.addEventListener('change', () => {
        segments.forEach((s, j) => s.classList.toggle('selected', i === j));
      });
    });

    this.el.querySelector('#start-btn')!.addEventListener('click', () => this.submit());
    this.updateMode();
  }

  private updateMode(): void {
    const mode = this.selectedMode();
    const firstToX = mode === 'first-to-x';
    this.controlSection.classList.toggle('hidden', mode === 'ffa');
    this.aiCountField.classList.toggle('hidden', firstToX);
    this.firstToField.classList.toggle('hidden', !firstToX);
    this.randomSizeRow.classList.toggle('hidden', firstToX);
    if (!firstToX) {
      this.aiInput.min = mode === 'pve' ? '1' : '2';
      if (mode === 'ffa' && parseInt(this.aiInput.value, 10) < 2) this.aiInput.value = '2';
    }
    this.updateSizeFields();
  }

  /** Hide the manual width/height inputs when Random Size is ticked, or always
   *  in First-to-x mode (board size is randomized between rounds). */
  private updateSizeFields(): void {
    const hide = this.randomCheck.checked || this.selectedMode() === 'first-to-x';
    for (const f of this.sizeFields) f.classList.toggle('hidden', hide);
  }

  private selectedMode(): GameMode {
    return (this.modeRadios.find((r) => r.checked)?.value as GameMode) ?? 'pve';
  }

  private selectedControl(): ControlMode {
    return (this.controlRadios.find((r) => r.checked)?.value as ControlMode) ?? 'classic';
  }

  private submit(): void {
    const mode = this.selectedMode();

    if (mode === 'first-to-x') {
      const firstTo = Math.round(parseInt(this.firstToInput.value, 10) || DEFAULT_FIRST_TO);
      if (firstTo < MIN_FIRST_TO) {
        this.errorEl.textContent = `First to must be at least ${MIN_FIRST_TO}.`;
        return;
      }
      const size = randomBoardSize(2 * 4); // player + one AI need ≥ 8 cells
      this.errorEl.textContent = '';
      const speedIdx = Math.min(parseInt(this.speedSlider.value, 10), StartScreen.SPEED_LEVELS.length - 1);
      this.onStartCb({
        mode,
        aiCount: 1,
        controlMode: this.selectedControl(),
        width: size.w,
        height: size.h,
        fair: this.fairCheck.checked,
        speedMultiplier: StartScreen.SPEED_LEVELS[speedIdx] ?? 1,
        targetScore: firstTo,
      });
      return;
    }

    const aiCount = Math.round(parseInt(this.aiInput.value, 10) || 1);
    const tanks = mode === 'pve' ? 1 + aiCount : aiCount;

    if (mode === 'pve' && aiCount < 1) {
      this.errorEl.textContent = 'Pick at least 1 AI opponent.';
      return;
    }
    if (mode === 'ffa' && aiCount < 2) {
      this.errorEl.textContent = 'Free-for-all needs at least 2 AutoPlayers.';
      return;
    }

    let width: number;
    let height: number;
    if (this.randomCheck.checked) {
      const size = randomBoardSize(tanks * 4);
      width = size.w;
      height = size.h;
    } else {
      width = Math.round(parseInt(this.widthInput.value, 10) || MIN_BOARD);
      height = Math.round(parseInt(this.heightInput.value, 10) || MIN_BOARD);
      if (width < MIN_BOARD || width > MAX_BOARD || height < MIN_BOARD || height > MAX_BOARD) {
        this.errorEl.textContent = `Board size must be ${MIN_BOARD}–${MAX_BOARD} on each side.`;
        return;
      }
      if (width * height < tanks * 4) {
        this.errorEl.textContent = `Board too small for ${tanks} tanks — needs ≥ ${tanks * 4} cells.`;
        return;
      }
    }

    this.errorEl.textContent = '';
    const speedIdx = Math.min(parseInt(this.speedSlider.value, 10), StartScreen.SPEED_LEVELS.length - 1);
    this.onStartCb({
      mode,
      aiCount,
      controlMode: this.selectedControl(),
      width,
      height,
      fair: this.fairCheck.checked,
      speedMultiplier: StartScreen.SPEED_LEVELS[speedIdx] ?? 1,
    });
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
