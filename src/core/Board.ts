import type { Vec2 } from '../math/Vec2';
import { vec2 } from '../math/Vec2';
import type { Rect } from '../math/geometry';
import { MIN_BOARD, MAX_BOARD, WALL_PROB } from '../config';
import type { WorldMetrics } from './metrics';

/** Small deterministic PRNG (mulberry32) so a match can be replayed from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampInt = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(v)));

/**
 * Walls are thin segments along the grid lines (not filled blocks): the arena
 * is a maze of wall lines, and every cell interior is walkable. A horizontal
 * wall at row r spans cells c..c+1; a vertical wall at column c spans rows
 * r..r+1. The border is always walled.
 */
export class Board {
  readonly width: number;
  readonly height: number;
  readonly cell: number;
  readonly canvasW: number;
  readonly canvasH: number;
  readonly fair: boolean;
  readonly seed: number;
  /** Thin rectangles (collision geometry + rendering). */
  readonly walls: Rect[] = [];

  /** hWall[r][c]: segment along the horizontal grid line y = r·cell, columns c..c+1. r ∈ [0,H]. */
  private hWall: Uint8Array;
  /** vWall[r][c]: segment along the vertical grid line x = c·cell, rows r..r+1. c ∈ [0,W]. */
  private vWall: Uint8Array;

  private wallBuckets = new Map<number, Rect[]>();

  constructor(width: number, height: number, fair: boolean, metrics: WorldMetrics, seed?: number) {
    this.width = clampInt(width, MIN_BOARD, MAX_BOARD);
    this.height = clampInt(height, MIN_BOARD, MAX_BOARD);
    this.fair = fair;
    this.seed = seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.cell = metrics.cell;
    this.canvasW = this.width * this.cell;
    this.canvasH = this.height * this.cell;
    this.hWall = new Uint8Array((this.height + 1) * this.width);
    this.vWall = new Uint8Array(this.height * (this.width + 1));

    const rng = mulberry32(this.seed);
    this.generate(rng);
    this.ensureConnectivity();
    this.buildWalls(metrics);
  }

  private hIdx(r: number, c: number): number {
    return r * this.width + c;
  }

  private vIdx(r: number, c: number): number {
    return r * (this.width + 1) + c;
  }

  hWallAt(r: number, c: number): boolean {
    if (r < 0 || r > this.height || c < 0 || c >= this.width) return true;
    return this.hWall[this.hIdx(r, c)] === 1;
  }

  vWallAt(r: number, c: number): boolean {
    if (r < 0 || r >= this.height || c < 0 || c > this.width) return true;
    return this.vWall[this.vIdx(r, c)] === 1;
  }

  /** Cells are always walkable in bounds (walls live on the edges). */
  isOpen(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.height && c < this.width;
  }

  isWall(r: number, c: number): boolean {
    return !this.isOpen(r, c);
  }

  cellCenter(r: number, c: number): Vec2 {
    return vec2((c + 0.5) * this.cell, (r + 0.5) * this.cell);
  }

  cellAt(px: number, py: number): { r: number; c: number } {
    return { r: Math.floor(py / this.cell), c: Math.floor(px / this.cell) };
  }

  /** Orthogonally adjacent cells reachable without crossing a wall segment. */
  openNeighbors(r: number, c: number): { r: number; c: number }[] {
    const out: { r: number; c: number }[] = [];
    if (r > 0 && this.hWall[this.hIdx(r, c)] === 0) out.push({ r: r - 1, c });
    if (r < this.height - 1 && this.hWall[this.hIdx(r + 1, c)] === 0) out.push({ r: r + 1, c });
    if (c > 0 && this.vWall[this.vIdx(r, c)] === 0) out.push({ r, c: c - 1 });
    if (c < this.width - 1 && this.vWall[this.vIdx(r, c + 1)] === 0) out.push({ r, c: c + 1 });
    return out;
  }

  /** True when the two cells are orthogonally adjacent with no wall between them. */
  canPass(r1: number, c1: number, r2: number, c2: number): boolean {
    if (r1 === r2 && c1 === c2) return true;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
    if (r2 === r1 + 1) return this.hWall[this.hIdx(r2, c1)] === 0;
    if (r2 === r1 - 1) return this.hWall[this.hIdx(r1, c1)] === 0;
    if (c2 === c1 + 1) return this.vWall[this.vIdx(r1, c2)] === 0;
    return this.vWall[this.vIdx(r1, c1)] === 0;
  }

  /**
   * BFS path over cells from (startR,startC) to (goalR,goalC).
   * Returns waypoint cells (excluding the start) or null when unreachable.
   * Connectivity is guaranteed, so this normally always succeeds.
   */
  findPath(startR: number, startC: number, goalR: number, goalC: number): { r: number; c: number }[] | null {
    const W = this.width;
    const H = this.height;
    if (!this.isOpen(startR, startC) || !this.isOpen(goalR, goalC)) return null;
    const startIdx = startR * W + startC;
    const goalIdx = goalR * W + goalC;
    const prev = new Int32Array(W * H).fill(-1);
    prev[startIdx] = startIdx;
    const queue: number[] = [startIdx];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === goalIdx) break;
      const r = Math.floor(cur / W);
      const c = cur % W;
      for (const nb of this.openNeighbors(r, c)) {
        const ni = nb.r * W + nb.c;
        if (prev[ni] === -1) {
          prev[ni] = cur;
          queue.push(ni);
        }
      }
    }
    if (prev[goalIdx] === -1) return null;
    const path: { r: number; c: number }[] = [];
    let cur = goalIdx;
    while (cur !== startIdx) {
      path.push({ r: Math.floor(cur / W), c: cur % W });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  /** Wall rects that border the cells touched by the given pixel bbox. */
  wallsInBBox(x0: number, y0: number, x1: number, y1: number): Rect[] {
    const c0 = this.cellAt(Math.min(x0, x1), Math.min(y0, y1));
    const c1 = this.cellAt(Math.max(x0, x1), Math.max(y0, y1));
    const seen = new Set<Rect>();
    const out: Rect[] = [];
    for (let r = c0.r; r <= c1.r; r++) {
      for (let c = c0.c; c <= c1.c; c++) {
        const bucket = this.wallBuckets.get(r * this.width + c);
        if (!bucket) continue;
        for (const w of bucket) {
          if (!seen.has(w)) {
            seen.add(w);
            out.push(w);
          }
        }
      }
    }
    return out;
  }

  private generate(rng: () => number): void {
    const W = this.width;
    const H = this.height;
    this.hWall.fill(0);
    this.vWall.fill(0);

    // Sealed border.
    for (let c = 0; c < W; c++) {
      this.hWall[this.hIdx(0, c)] = 1;
      this.hWall[this.hIdx(H, c)] = 1;
    }
    for (let r = 0; r < H; r++) {
      this.vWall[this.vIdx(r, 0)] = 1;
      this.vWall[this.vIdx(r, W)] = 1;
    }

    // Interior horizontal segments (r in 1..H-1). Fair mode mirrors columns.
    for (let r = 1; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (this.fair) {
          const mc = W - 1 - c;
          if (c <= Math.floor((W - 1) / 2)) {
            const w = rng() < WALL_PROB ? 1 : 0;
            this.hWall[this.hIdx(r, c)] = w;
            if (mc !== c) this.hWall[this.hIdx(r, mc)] = w;
          }
        } else {
          this.hWall[this.hIdx(r, c)] = rng() < WALL_PROB ? 1 : 0;
        }
      }
    }

    // Interior vertical segments (c in 1..W-1).
    for (let c = 1; c < W; c++) {
      for (let r = 0; r < H; r++) {
        if (this.fair) {
          const mc = W - c;
          if (c <= Math.floor(W / 2)) {
            const w = rng() < WALL_PROB ? 1 : 0;
            this.vWall[this.vIdx(r, c)] = w;
            if (mc !== c) this.vWall[this.vIdx(r, mc)] = w;
          }
        } else {
          this.vWall[this.vIdx(r, c)] = rng() < WALL_PROB ? 1 : 0;
        }
      }
    }
  }

  /** Carve wall segments until every cell is reachable (mirrored when fair). */
  private ensureConnectivity(): void {
    const W = this.width;
    const H = this.height;
    const visited = new Uint8Array(W * H);
    const queue: number[] = [0];
    visited[0] = 1;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const r = Math.floor(cur / W);
      const c = cur % W;
      for (const nb of this.openNeighbors(r, c)) {
        const ni = nb.r * W + nb.c;
        if (!visited[ni]) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (visited[r * W + c]) continue;
        // Nearest visited cell.
        let br = 0;
        let bc = 0;
        let bestD = Infinity;
        for (let vr = 0; vr < H; vr++) {
          for (let vc = 0; vc < W; vc++) {
            if (!visited[vr * W + vc]) continue;
            const d = Math.abs(vr - r) + Math.abs(vc - c);
            if (d < bestD) {
              bestD = d;
              br = vr;
              bc = vc;
            }
          }
        }
        // Carve a straight path, then re-BFS to merge the newly open region.
        let cr = r;
        let cc = c;
        while (cr !== br || cc !== bc) {
          if (Math.abs(br - cr) >= Math.abs(bc - cc)) {
            if (br > cr) {
              this.clearH(cr + 1, cc);
              cr++;
            } else {
              this.clearH(cr, cc);
              cr--;
            }
          } else {
            if (bc > cc) {
              this.clearV(cr, cc + 1);
              cc++;
            } else {
              this.clearV(cr, cc);
              cc--;
            }
          }
        }
        const region = new Uint8Array(W * H);
        const q: number[] = [r * W + c];
        region[r * W + c] = 1;
        while (q.length > 0) {
          const cur = q.shift()!;
          const crr = Math.floor(cur / W);
          const ccc = cur % W;
          for (const nb of this.openNeighbors(crr, ccc)) {
            const ni = nb.r * W + nb.c;
            if (!visited[ni] && !region[ni]) {
              region[ni] = 1;
              q.push(ni);
            }
          }
        }
        for (let i = 0; i < W * H; i++) {
          if (region[i]) visited[i] = 1;
        }
      }
    }
  }

  private clearH(r: number, c: number): void {
    this.hWall[this.hIdx(r, c)] = 0;
    if (this.fair) {
      const mc = this.width - 1 - c;
      if (mc !== c) this.hWall[this.hIdx(r, mc)] = 0;
    }
  }

  private clearV(r: number, c: number): void {
    this.vWall[this.vIdx(r, c)] = 0;
    if (this.fair) {
      const mc = this.width - c;
      if (mc !== c) this.vWall[this.vIdx(r, mc)] = 0;
    }
  }

  /** Build thin wall rects centered on the grid lines, bucketed by cell. */
  private buildWalls(metrics: WorldMetrics): void {
    const t = metrics.wallThickness;
    const t2 = t / 2;
    const W = this.width;
    const H = this.height;
    this.walls.length = 0;
    this.wallBuckets.clear();

    const addWall = (rect: Rect, cells: [number, number][]) => {
      this.walls.push(rect);
      for (const [r, c] of cells) {
        const key = r * W + c;
        const bucket = this.wallBuckets.get(key);
        if (bucket) bucket.push(rect);
        else this.wallBuckets.set(key, [rect]);
      }
    };

    for (let r = 0; r <= H; r++) {
      for (let c = 0; c < W; c++) {
        if (this.hWall[this.hIdx(r, c)] === 1) {
          const rect: Rect = { x: c * this.cell, y: r * this.cell - t2, w: this.cell, h: t };
          const cells: [number, number][] = [];
          if (r > 0) cells.push([r - 1, c]);
          if (r < H) cells.push([r, c]);
          addWall(rect, cells);
        }
      }
    }
    for (let r = 0; r < H; r++) {
      for (let c = 0; c <= W; c++) {
        if (this.vWall[this.vIdx(r, c)] === 1) {
          const rect: Rect = { x: c * this.cell - t2, y: r * this.cell, w: t, h: this.cell };
          const cells: [number, number][] = [];
          if (c > 0) cells.push([r, c - 1]);
          if (c < W) cells.push([r, c]);
          addWall(rect, cells);
        }
      }
    }
  }

  /**
   * Pick distinct spawn points, as far apart as possible. When `preferLeft` is
   * true the first spawn sits on the left half (the player's side in PvE); in
   * fair mode it is paired with its mirror on the right.
   */
  pickSpawns(count: number, preferLeft: boolean): Vec2[] {
    const pool: { r: number; c: number }[] = [];
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) pool.push({ r, c });
    }

    const chosen: Vec2[] = [];
    const take = (r: number, c: number) => chosen.push(this.cellCenter(r, c));

    const c0 = preferLeft
      ? Math.floor((this.width - 1) * 0.3)
      : Math.floor(this.width / 2);
    const first = this.pickNearest(pool, Math.floor(this.height / 2), c0);
    if (first) {
      take(first.r, first.c);
      if (this.fair && chosen.length < count) {
        const mc = this.width - 1 - first.c;
        if (mc !== first.c) {
          const mirror = this.pickCell(pool, first.r, mc);
          if (mirror) take(mirror.r, mirror.c);
        }
      }
    }

    // Greedy: repeatedly add the candidate farthest from everything chosen.
    while (chosen.length < count) {
      let bestCell: { r: number; c: number } | null = null;
      let bestD = -1;
      for (const cell of pool) {
        const p = this.cellCenter(cell.r, cell.c);
        let minD = Infinity;
        for (const c2 of chosen) {
          minD = Math.min(minD, Math.hypot(p.x - c2.x, p.y - c2.y));
        }
        if (minD > bestD) {
          bestD = minD;
          bestCell = cell;
        }
      }
      if (!bestCell) break;
      take(bestCell.r, bestCell.c);
    }
    return chosen;
  }

  private pickNearest(
    pool: { r: number; c: number }[],
    r: number,
    c: number,
  ): { r: number; c: number } | null {
    let best: { r: number; c: number } | null = null;
    let bestD = Infinity;
    for (const cell of pool) {
      const d = Math.abs(cell.r - r) + Math.abs(cell.c - c);
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
    return best;
  }

  private pickCell(
    pool: { r: number; c: number }[],
    r: number,
    c: number,
  ): { r: number; c: number } | null {
    for (const cell of pool) {
      if (cell.r === r && cell.c === c) return cell;
    }
    return null;
  }
}
