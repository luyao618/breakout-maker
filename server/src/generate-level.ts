import OpenAI from "openai";
import type { Brick, Level } from "./types.js";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1",
});

const LLM_MODEL = process.env.LLM_MODEL || "Qwen/Qwen2.5-7B-Instruct";

const SYSTEM_PROMPT = `You are an expert pixel-art level designer for a brick-breaker game called "造砖厂".

## How the grid works
- The grid is 20 columns (col 0-19) × 10 rows (row 0-9).
- row 0 = TOP of screen, row 9 = BOTTOM (near the paddle).
- col 0 = LEFT edge, col 19 = RIGHT edge.
- The center of the grid is around col 9-10.
- Shapes should be CENTERED horizontally and vertically on the grid.

## Design method — THINK IN ASCII FIRST
Before generating JSON, mentally draw the shape on a 20×10 ASCII grid:
- Use "." for empty, "1" for hp:1, "2" for hp:2, "3" for hp:3, "X" for hp:10
- Make sure the shape is SYMMETRIC where appropriate
- Make sure the shape is CENTERED on the grid
- Fill interiors densely — don't just draw outlines

Example: a diamond shape should look like this on the grid:
row0: ..........33..........
row1: ........3..113........
row2: ......3..1111..3......
row3: ....3..111111..3......
row4: ..3..11111111..3......  ← widest point at middle rows
row5: ....3..111111..3......
row6: ......3..1111..3......
row7: ........3..113........
row8: ..........33..........
row9: ....................    ← empty for gameplay

## Brick HP as shading
- hp:3 (brass/bright) = outlines, edges, highlights
- hp:2 (copper/medium) = inner details, accents, windows, features
- hp:1 (bronze/light) = interior fill, body
- hp:10 (iron/dark) = bases, ground, structural pillars, feet

## Rules
- ALWAYS use gridWidth: 20, gridHeight: 10.
- Target 80-160 bricks. Dense and detailed.
- Shapes must be VISUALLY RECOGNIZABLE and CENTERED.
- Use SYMMETRY for symmetric shapes (hearts, diamonds, stars, etc.).
- Leave row 9 mostly empty (gameplay space near paddle).
- ballSpeed: 280-320, paddleWidth: 80-110, lives: 3-5.

## JSON output format
{
  "gridWidth": 20, "gridHeight": 10,
  "ballSpeed": 300, "paddleWidth": 90, "lives": 4,
  "bricks": [ {"row":0,"col":9,"hp":3}, ... ]
}

Output ONLY the JSON object. No ASCII art in output. No markdown. No explanation.`;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function validateAndCleanLevel(raw: unknown, prompt: string): Level {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("AI response is not a valid JSON object");
  }

  const data = raw as Record<string, unknown>;

  // Clamp grid dimensions
  const gridWidth = clamp(Number(data.gridWidth) || 20, 8, 20);
  const gridHeight = clamp(Number(data.gridHeight) || 10, 6, 12);
  const ballSpeed = clamp(Number(data.ballSpeed) || 300, 250, 350);
  const paddleWidth = clamp(Number(data.paddleWidth) || 90, 80, 120);
  const lives = clamp(Number(data.lives) || 4, 3, 5);

  // Validate bricks array exists
  if (!Array.isArray(data.bricks)) {
    throw new Error("AI response missing bricks array");
  }

  const VALID_HP = new Set([1, 2, 3, 10]);
  const seen = new Set<string>();
  const bricks: Brick[] = [];

  for (const b of data.bricks) {
    if (typeof b !== "object" || b === null || Array.isArray(b)) continue;

    const brick = b as Record<string, unknown>;
    if (!("row" in brick) || !("col" in brick) || !("hp" in brick)) continue;
    const row = clamp(Number(brick.row) || 0, 0, gridHeight - 1);
    const col = clamp(Number(brick.col) || 0, 0, gridWidth - 1);
    let hp = Math.round(Number(brick.hp) || 1);

    // Clamp hp to nearest valid value
    if (!VALID_HP.has(hp)) {
      if (hp <= 1) hp = 1;
      else if (hp <= 2) hp = 2;
      else if (hp <= 6) hp = 3;
      else hp = 10;
    }

    // Deduplicate by (row, col) — keep first occurrence
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    seen.add(key);

    bricks.push({ row, col, hp });
  }

  if (bricks.length < 20) {
    throw new Error(
      `AI generated only ${bricks.length} bricks (minimum 50 required)`
    );
  }

  // Cap at 400 bricks
  if (bricks.length > 400) {
    bricks.length = 400;
  }

  return {
    name: "AI - " + prompt.slice(0, 20),
    gridWidth,
    gridHeight,
    ballSpeed,
    paddleWidth,
    lives,
    bricks,
  };
}

export async function generateLevel(prompt: string): Promise<Level> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await openai.chat.completions.create(
      {
        model: LLM_MODEL,
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `设计一个砖块关卡，形状是：${prompt}\n\n要求：1) 形状必须左右对称，水平居中于 col 9-10 附近。2) 内部必须填满砖块，不要留空洞。3) 尽量多放砖块，至少80个。`,
          },
        ],
      },
      { signal: controller.signal }
    );

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AI 返回了空响应");
    }

    // Strip <think>...</think> blocks from reasoning models (e.g. DeepSeek-R1)
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Extract JSON object if wrapped in markdown code fences
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI 返回了无效的数据格式，请重试");
    }
    return validateAndCleanLevel(parsed, prompt);
  } catch (err) {
    if (controller.signal.aborted) {
      const timeoutErr = new Error("AI 生成超时，请重试");
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
