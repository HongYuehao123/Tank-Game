export class HUD {
  private el: HTMLElement;
  private hintEl: HTMLElement;
  private aliveEl: HTMLElement;
  private modeEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private onPauseCb: () => void;
  private onRestartCb: () => void;

  constructor(container: HTMLElement, onPause: () => void, onRestart: () => void) {
    this.onPauseCb = onPause;
    this.onRestartCb = onRestart;

    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-left">
        <span class="hud-chip accent" id="hud-alive">Alive: –</span>
        <span class="hud-chip" id="hud-mode">–</span>
      </div>
      <div class="hud-right">
        <button class="btn-ghost" id="hud-pause">Pause</button>
        <button class="btn-ghost" id="hud-restart">Restart</button>
      </div>
    `;
    container.appendChild(this.el);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hint-bar hidden';
    this.hintEl.textContent = '';
    container.appendChild(this.hintEl);

    this.aliveEl = this.el.querySelector('#hud-alive')!;
    this.modeEl = this.el.querySelector('#hud-mode')!;
    this.pauseBtn = this.el.querySelector('#hud-pause')!;
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
}
