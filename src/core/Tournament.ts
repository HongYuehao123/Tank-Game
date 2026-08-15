/**
 * First-to-x series state. The series is a first-to-N sequence of
 * 1v1 rounds (human player vs one AutoPlayer); the board and its size are
 * re-randomized between rounds. This object only tracks the score — the
 * per-round Game instance is owned by main.ts.
 */
export type RoundResult = 'player' | 'ai' | 'draw';

export class TournamentSession {
  player = 0;
  ai = 0;
  readonly target: number;

  constructor(target: number) {
    this.target = Math.max(1, Math.floor(target) || 1);
  }

  /** True once either side has reached the first-to target. */
  get isOver(): boolean {
    return this.player >= this.target || this.ai >= this.target;
  }

  /** Winning side once over; null while the series is still running. */
  get champion(): 'player' | 'ai' | null {
    if (this.player >= this.target) return 'player';
    if (this.ai >= this.target) return 'ai';
    return null;
  }

  /** Record a round. A draw scores nothing (the round is replayed). */
  record(winner: 'player' | 'ai' | null): void {
    if (winner === 'player') this.player += 1;
    else if (winner === 'ai') this.ai += 1;
  }

  reset(): void {
    this.player = 0;
    this.ai = 0;
  }
}
