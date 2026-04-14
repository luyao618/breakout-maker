import OpenAI from "openai";
import type { Brick, Level } from "./types.js";
import { parseAsciiGrid, assignHP, enforceSymmetry, extractAsciiGrid } from "./ascii-parser.js";
import { matchTemplate, getTemplateWithVariation, GRID_W, GRID_H } from "./templates.js";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1",
});

const LLM_MODEL = process.env.LLM_MODEL || "Qwen/Qwen2.5-7B-Instruct";

// ---------------------------------------------------------------------------
// System prompt: binary ASCII grid output (./#)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a pixel-art designer for a brick-breaker game. You draw shapes as ASCII grids.

## Grid format
- Output EXACTLY 15 lines, each EXACTLY 30 characters.
- Use: . = empty, # = filled brick.
- No other characters. No explanation. No markdown.

## Rules
- CENTER the shape horizontally and vertically on the grid.
- Use SYMMETRY for symmetric shapes (hearts, stars, diamonds, etc.).
- Fill interiors DENSELY — don't just draw outlines.
- Leave the bottom row (row 15) mostly empty for gameplay.
- The shape must be RECOGNIZABLE.
- Use the full 30×15 canvas to make detailed, recognizable shapes.

## Examples

Heart (心形):
......####......####..........
.....######....######.........
....########..########........
...####################.......
...####################.......
...####################.......
....##################........
.....################.........
.......############...........
.........########.............
...........####...............
.............##...............
..............................
..............................
..............................

Diamond (钻石):
..............##..............
.............####.............
............######............
...........########...........
..........##########..........
.........############.........
..........##########..........
...........########...........
............######............
.............####.............
..............##..............
..............................
..............................
..............................
..............................

Castle (城堡):
....#.#.#...........#.#.#.....
....#####...........#####.....
....#####...........#####.....
....#####...........#####.....
....#####...##..##..#####.....
..############################
..############################
..############################
..############################
..############################
..############################
..##########......############
..##########......############
..##########......############
..............................

Output ONLY the 15 lines of the grid. Nothing else.`;

// ---------------------------------------------------------------------------
// Symmetric shape keywords for enforceSymmetry post-processing
// ---------------------------------------------------------------------------
const SYMMETRIC_KEYWORDS = [
  "心", "爱", "heart",
  "钻石", "菱形", "diamond",
  "星", "star",
  "城堡", "castle",
  "箭头", "arrow",
  "笑脸", "smiley", "face",
  "皇冠", "crown",
  "雪花", "snowflake",
  "彩虹", "rainbow",
  "对称",
];

function isSymmetricPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return SYMMETRIC_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------
export async function generateLevel(prompt: string): Promise<Level> {
  // --- Phase 1: Try template match first (instant, free, perfect) ---
  const templateGrid = matchTemplate(prompt);
  if (templateGrid) {
    const varied = getTemplateWithVariation(templateGrid);
    return gridToLevel(varied, prompt);
  }

  // --- Phase 2: LLM ASCII generation ---
  return generateFromLLM(prompt);
}

/**
 * Convert a parsed ASCII grid (string[]) to a Level object.
 */
function gridToLevel(grid: string[], prompt: string): Level {
  const gridW = GRID_W;
  const gridH = GRID_H;

  // Parse ASCII to bricks (all hp=1)
  let bricks = parseAsciiGrid(grid.join("\n"), gridW, gridH);

  // Assign HP via border detection
  bricks = assignHP(bricks, gridW, gridH);

  // Enforce symmetry for symmetric shapes
  if (isSymmetricPrompt(prompt)) {
    bricks = enforceSymmetry(bricks, gridW);
    // Re-assign HP after symmetry enforcement changes the shape
    bricks = assignHP(bricks, gridW, gridH);
  }

  // Validate brick count
  if (bricks.length < 10) {
    throw new Error(
      `生成的关卡砖块太少 (${bricks.length} 个，最少需要 10 个)`
    );
  }

  if (bricks.length > 350) {
    bricks = bricks.slice(0, 350);
  }

  return {
    name: "AI - " + prompt.slice(0, 20),
    gridWidth: gridW,
    gridHeight: gridH,
    ballSpeed: 300,
    paddleWidth: 90,
    lives: 4,
    bricks,
  };
}

/**
 * Generate a level via LLM ASCII grid output.
 */
async function generateFromLLM(prompt: string): Promise<Level> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await openai.chat.completions.create(
      {
        model: LLM_MODEL,
        temperature: 0.2,
        max_tokens: 1500,
        // NO response_format — let the model output raw ASCII
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `画一个「${prompt}」的形状。要求：1) 在 30×15 的网格上，形状居中，左右对称 2) 内部填满，不留空洞 3) 形状必须可识别，利用更大的画布画出更多细节`,
          },
        ],
      },
      { signal: controller.signal }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AI 返回了空响应");
    }

    // Extract the ASCII grid from potentially messy output
    const cleanAscii = extractAsciiGrid(content);
    if (!cleanAscii) {
      throw new Error("AI 返回的内容中未找到有效的网格数据");
    }

    return gridToLevel(cleanAscii.split("\n"), prompt);
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
