export interface Brick {
  row: number;
  col: number;
  hp: number;
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

export interface GenerateRequest {
  prompt: string;
}

export type GenerateResponse = Level | { error: string };
