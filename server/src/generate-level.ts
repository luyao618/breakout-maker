import type { Brick, Level } from "./types.js";
import { buildLevel } from "./types.js";
import { parseAsciiGrid, enforceSymmetry } from "./ascii-parser.js";
import { matchTemplate, getTemplateWithVariation, GRID_W, GRID_H } from "./templates.js";
import { generateFromImage } from "./generate-image.js";

// ---------------------------------------------------------------------------
// Symmetric shape keywords for enforceSymmetry post-processing
// (used only by the template fast-path)
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
    console.log(`[generate-level] Template match for "${prompt}"`);
    const varied = getTemplateWithVariation(templateGrid);
    return gridToLevel(varied, prompt);
  }

  // --- Phase 2: Image generation + pixel sampling ---
  console.log(`[generate-level] No template match, using image generation for "${prompt}"`);
  return generateFromImage(prompt);
}

/**
 * Convert a parsed ASCII grid (string[]) to a Level object.
 * Used by the template fast-path only.
 *
 * At 56×40 (2240 cells), all bricks stay hp=1 for pixel-art feel.
 * Symmetry is enforced for known symmetric shapes.
 */
function gridToLevel(grid: string[], prompt: string): Level {
  const gridW = GRID_W;
  const gridH = GRID_H;

  // Parse ASCII to bricks (all hp=1)
  let bricks = parseAsciiGrid(grid.join("\n"), gridW, gridH);

  // Enforce symmetry for known symmetric shapes
  if (isSymmetricPrompt(prompt)) {
    bricks = enforceSymmetry(bricks, gridW);
  }

  return buildLevel(bricks, prompt, gridW, gridH);
}
