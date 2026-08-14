export type GameMode = 'pve' | 'ffa';
export type ControlMode = 'classic' | 'modern';
export type Phase = 'idle' | 'playing' | 'paused' | 'over';

export interface InputState {
  keys: Record<string, boolean>;
  mouse: { x: number; y: number };
  /** Edge-latched: set on press, consumed by the player's update. */
  shoot: boolean;
}

export interface MatchConfig {
  mode: GameMode;
  /** PvE: number of AI opponents. FFA: total number of AI tanks. */
  aiCount: number;
  controlMode: ControlMode;
  width: number;
  height: number;
  fair: boolean;
  /** Movement speed multiplier for all tanks: 1 | 4/3 | 5/3 | 2. */
  speedMultiplier: number;
}
