export interface Brick {
  row: number;
  col: number;
  hp: number;
  /** Optional hex colour from image-generated levels (e.g. "#ff8800"). */
  color?: string;
}

export interface Level {
  name: string;
  gridWidth: number;
  gridHeight: number;
  ballSpeed: number;
  paddleWidth: number;
  lives: number;
  bricks: Brick[];
}

/** Shared default gameplay constants for AI-generated levels.
 *  Forgiving params for the larger 56×40 grid with many bricks. */
export const LEVEL_DEFAULTS = {
  ballSpeed: 280,
  paddleWidth: 120,
  lives: 5,
} as const;

/** Minimum bricks required for a playable level. */
export const MIN_BRICKS = 10;

/**
 * Build a Level object from an array of bricks.
 * Validates brick count and applies shared gameplay defaults.
 */
export function buildLevel(
  bricks: Brick[],
  prompt: string,
  gridWidth: number,
  gridHeight: number,
): Level {
  if (bricks.length < MIN_BRICKS) {
    throw new Error(
      `生成的关卡砖块太少 (${bricks.length} 个，最少需要 ${MIN_BRICKS} 个)`
    );
  }

  return {
    name: "AI - " + prompt.slice(0, 20),
    gridWidth,
    gridHeight,
    ...LEVEL_DEFAULTS,
    bricks,
  };
}

export interface GenerateRequest {
  prompt: string;
}

export type GenerateResponse = Level | { error: string };
