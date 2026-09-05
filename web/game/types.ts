export type BrickColor = string | [string, string];

export interface LevelBrick {
  row: number;
  col: number;
  hp: number;
  color?: BrickColor;
}

export interface Level {
  name: string;
  gridWidth: number;
  gridHeight: number;
  ballSpeed: number;
  paddleWidth: number;
  lives: number;
  bricks: LevelBrick[];
}

export type GameStatus = "ready" | "playing" | "paused" | "won" | "lost";
export type PowerUpKind =
  "split" | "multiShot" | "fireball" | "widePaddle" | "extraLife";

export interface ActivePowerUp {
  type: PowerUpKind;
  timer: number;
}

/** Non-consuming presentation events, stamped with the simulation clock. */
export interface GameFeedback {
  id: number;
  time: number;
  kind:
    | "brick"
    | "paddle"
    | "wall"
    | "launch"
    | "lifeLost"
    | "powerSpawn"
    | "powerCollect"
    | "pulse"
    | "win"
    | "lose";
  x: number;
  y: number;
  color: string;
  power?: PowerUpKind;
  combo?: number;
  points?: number;
  strength: number;
}

export interface GameSnapshot {
  status: GameStatus;
  /** Alias retained for consumers that name their view state "phase". */
  phase: GameStatus;
  score: number;
  lives: number;
  combo: number;
  destroyed: number;
  total: number;
  levelIndex: number;
  levelName: string;
  activePowerUps: ActivePowerUp[];
  energy: number;
  pulseReady: boolean;
  /** Seconds of pulse overdrive remaining. */
  pulseTime: number;
  bestCombo: number;
  elapsed: number;
  lastPickup: { id: number; type: PowerUpKind; time: number } | null;
}

export interface GameProgress {
  unlockedLevels: number;
  levelVersion: 3;
}
