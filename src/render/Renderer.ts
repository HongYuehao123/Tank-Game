import type { Game } from '../core/Game';
import type { Tank } from '../entities/Tank';
import { PALETTE } from '../config';

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  render(game: Game): void {
    const ctx = this.ctx;
    const board = game.board;
    const w = board ? board.canvasW : 720;
    const h = board ? board.canvasH : 720;

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);
    if (!board) return;

    // Walls are thin line segments on the grid — no background grid is drawn.
    ctx.fillStyle = PALETTE.wall;
    for (const wall of board.walls) {
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    }

    // Bullets — one shared look for everyone (player & AI alike).
    ctx.fillStyle = PALETTE.bullet;
    ctx.strokeStyle = PALETTE.barrel;
    ctx.lineWidth = 1;
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const t of game.tanks) {
      if (t.alive) this.drawTank(t);
    }
  }

  private drawTank(t: Tank): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(t.pos.x, t.pos.y);
    ctx.rotate(t.angle);

    const len = t.len;
    const wid = t.wid;

    // Barrel.
    ctx.fillStyle = PALETTE.barrel;
    ctx.fillRect(len / 2 - 2, -2.5, 12, 5);
    // Treads.
    ctx.fillStyle = PALETTE.tread;
    ctx.fillRect(-len / 2 + 2, wid / 2 - 4.5, len - 4, 3.5);
    ctx.fillRect(-len / 2 + 2, -wid / 2 + 1, len - 4, 3.5);
    // Body.
    ctx.fillStyle = t.color;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    // Facing notch.
    ctx.fillStyle = shade(t.color, 0.72);
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 2 - 5, -4);
    ctx.lineTo(len / 2 - 5, 4);
    ctx.closePath();
    ctx.fill();

    if (t.isPlayer) {
      ctx.strokeStyle = PALETTE.playerDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2, -wid / 2, len, wid);
    }
    ctx.restore();
  }
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
