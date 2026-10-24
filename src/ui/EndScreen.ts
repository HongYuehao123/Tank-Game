import type { Game } from '../core/Game';
import { PALETTE, TOURNAMENT_AI_COLOR } from '../config';

export class EndScreen {
  private el: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;
  private buttonsEl: HTMLElement;
  private againBtn: HTMLButtonElement;
  private onAgainCb: () => void;
  private onMenuCb: () => void;

  constructor(container: HTMLElement, onAgain: () => void, onMenu: () => void) {
    this.onAgainCb = onAgain;
    this.onMenuCb = onMenu;

    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    this.el.innerHTML = `
      <div class="card result-card">
        <p class="eyebrow">The arena has spoken</p>
        <h1 class="end-title" id="end-title">—</h1>
        <p class="end-desc" id="end-desc">—</p>
        <div class="end-buttons" id="end-buttons">
          <button class="btn-primary" id="end-again">PLAY AGAIN</button>
          <button class="btn-ghost" id="end-menu">MENU</button>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.titleEl = this.el.querySelector('#end-title')!;
    this.descEl = this.el.querySelector('#end-desc')!;
    this.buttonsEl = this.el.querySelector('#end-buttons')!;
    this.againBtn = this.el.querySelector('#end-again')!;
    this.el.querySelector('#end-again')!.addEventListener('click', () => this.onAgainCb());
    this.el.querySelector('#end-menu')!.addEventListener('click', () => this.onMenuCb());
  }

  show(game: Game): void {
    const cfg = game.config;
    const winner = game.winner;
    const color = winner ? winner.color : PALETTE.muted;

    let title: string;
    let desc: string;
    if (cfg.mode === 'pve') {
      if (game.player && game.player.alive) {
        title = 'YOU WIN!';
        desc = 'The last tank standing is you.';
      } else {
        title = 'YOU LOSE';
        desc = `${winner ? winner.name : 'An AI'} won the arena.`;
      }
    } else {
      title = winner ? `${winner.name} WINS` : 'DRAW';
      desc = winner ? 'Free-for-all champion.' : 'Nobody survived.';
    }

    this.titleEl.textContent = title;
    this.titleEl.style.color = cfg.mode === 'pve' && game.player && game.player.alive ? PALETTE.player : color;
    this.descEl.textContent = desc;
    this.setButtons(true, true);
    this.el.classList.remove('hidden');
  }

  /** Transient between-round overlay in First-to-x mode (no PLAY AGAIN; the
   *  next round auto-starts after a short delay, MENU abandons the series). */
  showRoundResult(
    result: 'player' | 'ai' | 'draw',
    playerScore: number,
    aiScore: number,
    target: number,
  ): void {
    let title: string;
    let color: string;
    let lead: string;
    if (result === 'player') {
      title = 'YOU WIN THE ROUND';
      color = PALETTE.player;
      lead = 'Round to you.';
    } else if (result === 'ai') {
      title = 'AI WINS THE ROUND';
      color = TOURNAMENT_AI_COLOR;
      lead = 'Round to the AutoPlayer.';
    } else {
      title = 'DRAW';
      color = PALETTE.muted;
      lead = 'No score — replaying the round.';
    }

    this.titleEl.textContent = title;
    this.titleEl.style.color = color;
    this.descEl.textContent = `${lead}  Score: You ${playerScore} – AI ${aiScore} (first to ${target})`;
    this.setButtons(false, true);
    this.el.classList.remove('hidden');
  }

  /** Final First-to-x result, with PLAY AGAIN (restarts the series) + MENU. */
  showFinal(champion: 'player' | 'ai', playerScore: number, aiScore: number, target: number): void {
    const color = champion === 'player' ? PALETTE.player : TOURNAMENT_AI_COLOR;
    this.titleEl.textContent = champion === 'player' ? 'FIRST-TO-X CHAMPION!' : 'AI WINS FIRST-TO-X';
    this.titleEl.style.color = color;
    this.descEl.textContent = `Final score: You ${playerScore} – AI ${aiScore} (first to ${target})`;
    this.setButtons(true, true);
    this.el.classList.remove('hidden');
  }

  private setButtons(again: boolean, menu: boolean): void {
    this.againBtn.classList.toggle('hidden', !again);
    this.el.querySelector<HTMLButtonElement>('#end-menu')!.classList.toggle('hidden', !menu);
    this.buttonsEl.classList.toggle('hidden', !again && !menu);
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
