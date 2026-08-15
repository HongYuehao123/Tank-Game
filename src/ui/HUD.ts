import { PALETTE, TOURNAMENT_AI_COLOR } from '../config';

/**
 * In-game HUD, rendered as a bar ABOVE the board (never covering it):
 * alive/mode chips on the left, the first-to-x scoreboard in the center,
 * pause/restart on the right. The control hints live in a separate bar below
 * the board.
 */
export class HUD {
  private el: HTMLElement;
  private hintEl: HTMLElement;
  private aliveEl: HTMLElement;
  private modeEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private scoreEl: HTMLElement;
  private playerScoreEl: HTMLElement;
  private aiScoreEl: HTMLElement;
  private targetEl: HTMLElement;
  private onPauseCb: () => void;
  private onRestartCb: () => void;

  constructor(
    bar: HTMLElement,
    hintBar: HTMLElement,
    onPause: () => void,
    onRestart: () => void,
  ) {
    this.onPauseCb = onPause;
    this.onRestartCb = onRestart;

    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-left">
        <span class="hud-chip accent" id="hud-alive">Alive: –</span>
        <span class="hud-chip" id="hud-mode">–</span>
      </div>
      <div class="tournament-score hidden" id="tournament-score">
        <span class="ts-chip" id="ts-player" style="color:${PALETTE.player}">You</span>
        <span class="ts-num" id="ts-player-score">0</span>
        <span class="ts-sep">–</span>
        <span class="ts-num" id="ts-ai-score">0</span>
        <span class="ts-chip" id="ts-ai" style="color:${TOURNAMENT_AI_COLOR}">AI</span>
        <span class="ts-target" id="ts-target">First to 5</span>
      </div>
      <div class="hud-right">
        <button class="btn-ghost" id="hud-pause">Pause</button>
        <button class="btn-ghost" id="hud-restart">Restart</button>
      </div>
    `;
    bar.appendChild(this.el);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hint-bar hidden';
    this.hintEl.textContent = '';
    hintBar.appendChild(this.hintEl);

    this.aliveEl = this.el.querySelector('#hud-alive')!;
    this.modeEl = this.el.querySelector('#hud-mode')!;
    this.pauseBtn = this.el.querySelector('#hud-pause')!;
    this.scoreEl = this.el.querySelector('#tournament-score')!;
    this.playerScoreEl = this.el.querySelector('#ts-player-score')!;
    this.aiScoreEl = this.el.querySelector('#ts-ai-score')!;
    this.targetEl = this.el.querySelector('#ts-target')!;
    this.el.querySelector('#hud-restart')!.addEventListener('click', () => this.onRestartCb());
    this.pauseBtn.addEventListener('click', () => {
      this.onPauseCb();
      this.setPaused(this.pauseBtn.textContent === 'Resume');
    });
  }

  show(modeLabel: string, hint: string): void {
    this.el.classList.remove('hidden');
    this.hintEl.classList.remove('hidden');
    this.modeEl.textContent = modeLabel;
    this.hintEl.textContent = hint;
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.hintEl.classList.add('hidden');
  }

  update(alive: number, total: number, modeLabel: string, hint: string): void {
    this.aliveEl.textContent = `Alive: ${alive} / ${total}`;
    this.modeEl.textContent = modeLabel;
    this.hintEl.textContent = hint;
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }

  /** Show and refresh the first-to-x scoreboard (only used in First-to-x mode). */
  setScore(player: number, ai: number, target: number): void {
    this.playerScoreEl.textContent = `${player}`;
    this.aiScoreEl.textContent = `${ai}`;
    this.targetEl.textContent = `First to ${target}`;
    this.scoreEl.classList.remove('hidden');
  }

  hideScore(): void {
    this.scoreEl.classList.add('hidden');
  }
}
