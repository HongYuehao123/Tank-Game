import type { ControlMode, GameMode, MatchConfig } from '../types';
import { MIN_BOARD, MAX_BOARD } from '../config';

/**
 * Starting page: game mode, AI count, board size, control mode (PvE only),
 * and the Fair Generation checkbox with its "Experimental" badge.
 */
export class StartScreen {
  private el: HTMLElement;
  private modeRadios: HTMLInputElement[];
  private controlRadios: HTMLInputElement[];
  private controlSection: HTMLElement;
  private aiInput: HTMLInputElement;
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private fairCheck: HTMLInputElement;
  private speedSlider: HTMLInputElement;
  private speedReadout: HTMLElement;
  private errorEl: HTMLElement;
  private onStartCb: (cfg: MatchConfig) => void;

  private static readonly SPEED_LEVELS = [1, 4 / 3, 5 / 3, 2];
  private static readonly SPEED_LABELS = ['1×', '1.33×', '1.67×', '2×'];

  constructor(container: HTMLElement, onStart: (cfg: MatchConfig) => void) {
    this.onStartCb = onStart;
    this.el = document.createElement('div');
    this.el.className = 'overlay';
    this.el.innerHTML = `
      <div class="card">
        <h1>TANK BATTLE</h1>
        <span class="accent"></span>
        <p class="subtitle">A 坦克动荡2-style arena — last tank standing wins.</p>

        <div class="field">
          <span class="field-label">Game Mode</span>
          <div class="mode-grid">
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
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label for="ai-count">${'AI Count'}</label>
            <input id="ai-count" type="number" min="1" max="19" value="3" />
          </div>
          <div class="field">
            <label for="board-width">Board Width (5–${MAX_BOARD})</label>
            <input id="board-width" type="number" min="${MIN_BOARD}" max="${MAX_BOARD}" value="12" />
          </div>
          <div class="field">
            <label for="board-height">Board Height (5–${MAX_BOARD})</label>
            <input id="board-height" type="number" min="${MIN_BOARD}" max="${MAX_BOARD}" value="12" />
          </div>
        </div>

        <div class="field">
          <span class="field-label">Faster Movement</span>
          <div class="speed-row">
            <input id="speed-slider" type="range" min="0" max="3" step="1" value="0" />
            <span class="speed-readout" id="speed-readout">1×</span>
          </div>
          <div class="speed-labels">
            <span>1×</span><span>1.33×</span><span>1.67×</span><span>2×</span>
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

        <p class="error-msg" id="start-error"></p>
        <button class="btn-primary" id="start-btn">START</button>
      </div>
    `;
    container.appendChild(this.el);

    this.modeRadios = Array.from(this.el.querySelectorAll<HTMLInputElement>('input[name="mode"]'));
    this.controlRadios = Array.from(this.el.querySelectorAll<HTMLInputElement>('input[name="control"]'));
    this.controlSection = this.el.querySelector('#control-section')!;
    this.aiInput = this.el.querySelector('#ai-count')!;
    this.widthInput = this.el.querySelector('#board-width')!;
    this.heightInput = this.el.querySelector('#board-height')!;
    this.fairCheck = this.el.querySelector('#fair')!;
    this.speedSlider = this.el.querySelector('#speed-slider')!;
    this.speedReadout = this.el.querySelector('#speed-readout')!;
    this.errorEl = this.el.querySelector('#start-error')!;

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
    this.controlSection.classList.toggle('hidden', mode === 'ffa');
    this.aiInput.min = mode === 'pve' ? '1' : '2';
    if (mode === 'ffa' && parseInt(this.aiInput.value, 10) < 2) this.aiInput.value = '2';
  }

  private selectedMode(): GameMode {
    return (this.modeRadios.find((r) => r.checked)?.value as GameMode) ?? 'pve';
  }

  private selectedControl(): ControlMode {
    return (this.controlRadios.find((r) => r.checked)?.value as ControlMode) ?? 'classic';
  }

  private submit(): void {
    const mode = this.selectedMode();
    const aiCount = Math.round(parseInt(this.aiInput.value, 10) || 1);
    const width = Math.round(parseInt(this.widthInput.value, 10) || MIN_BOARD);
    const height = Math.round(parseInt(this.heightInput.value, 10) || MIN_BOARD);
    const tanks = mode === 'pve' ? 1 + aiCount : aiCount;

    if (width < MIN_BOARD || width > MAX_BOARD || height < MIN_BOARD || height > MAX_BOARD) {
      this.errorEl.textContent = `Board size must be ${MIN_BOARD}–${MAX_BOARD} on each side.`;
      return;
    }
    if (mode === 'pve' && aiCount < 1) {
      this.errorEl.textContent = 'Pick at least 1 AI opponent.';
      return;
    }
    if (mode === 'ffa' && aiCount < 2) {
      this.errorEl.textContent = 'Free-for-all needs at least 2 AutoPlayers.';
      return;
    }
    if (width * height < tanks * 4) {
      this.errorEl.textContent = `Board too small for ${tanks} tanks — needs ≥ ${tanks * 4} cells.`;
      return;
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
