import type { Game } from '../core/Game';

export class EndScreen {
  private el: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;
  private onAgainCb: () => void;
  private onMenuCb: () => void;

  constructor(container: HTMLElement, onAgain: () => void, onMenu: () => void) {
    this.onAgainCb = onAgain;
    this.onMenuCb = onMenu;

    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    this.el.innerHTML = `
      <div class="card">
        <h1 class="end-title" id="end-title">—</h1>
        <p class="end-desc" id="end-desc">—</p>
        <div class="end-buttons">
          <button class="btn-primary" id="end-again">PLAY AGAIN</button>
          <button class="btn-ghost" id="end-menu">MENU</button>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this.titleEl = this.el.querySelector('#end-title')!;
    this.descEl = this.el.querySelector('#end-desc')!;
    this.el.querySelector('#end-again')!.addEventListener('click', () => this.onAgainCb());
    this.el.querySelector('#end-menu')!.addEventListener('click', () => this.onMenuCb());
  }

  show(game: Game): void {
    const cfg = game.config;
    const winner = game.winner;
    const color = winner ? winner.color : '#94a3b8';

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
    this.titleEl.style.color = cfg.mode === 'pve' && game.player && game.player.alive ? '#16a34a' : color;
    this.descEl.textContent = desc;
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
