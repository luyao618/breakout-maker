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
}

export interface GameProgress {
  unlockedLevels: number;
  levelVersion: 3;
}
