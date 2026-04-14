/**
 * generate-image.ts
 *
 * Image-based level generation for creative mode.
 *
 * Flow:
 *   1. User prompt → pixel-art image prompt → SiliconFlow image API
 *   2. Download generated image from returned URL
 *   3. Use `sharp` to resize to grid-proportional dimensions
 *   4. Sample pixels: compute average color & luminance per grid cell
 *   5. Convert to bricks: dark cells become bricks, light cells are empty
 *   6. Return Level with colored bricks
 */

import sharp from "sharp";
import type { Brick, Level } from "./types.js";
import { buildLevel } from "./types.js";
import { GRID_W, GRID_H } from "./templates.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IMAGE_MODEL = process.env.IMAGE_MODEL || "Qwen/Qwen-Image";
const IMAGE_API_URL =
  process.env.IMAGE_API_URL ||
  "https://api.siliconflow.cn/v1/images/generations";
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || process.env.LLM_API_KEY;

/** Oversampling factor: we resize the image to GRID × SAMPLE_FACTOR, then
 *  average each SAMPLE_FACTOR × SAMPLE_FACTOR block into one grid cell. */
const SAMPLE_FACTOR = 4;

/** Luminance thresholds for brick detection and HP assignment.
 *  Luminance is normalized to [0, 1] where 0 = black, 1 = white.
 *  Anything below BG_THRESHOLD is considered a brick (not background). */
const BG_THRESHOLD = 0.85;
const HP3_THRESHOLD = 0.3; // Very dark → hp 3 (toughest)
const HP2_THRESHOLD = 0.6; // Medium   → hp 2

/** Request timeout in milliseconds. */
const IMAGE_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

/**
 * Wrap a user prompt into a pixel-art image generation prompt.
 * This produces clean, flat shapes on white backgrounds that sample well.
 */
function buildImagePrompt(userPrompt: string): string {
  return (
    `pixel art, 8-bit style, ${userPrompt} shape, ` +
    `on pure white background, simple flat colors, clear sharp edges, ` +
    `no gradients, no shadows, no grid lines, centered, symmetrical, ` +
    `low resolution pixel grid`
  );
}

// ---------------------------------------------------------------------------
// Image API call
// ---------------------------------------------------------------------------

/**
 * Call the SiliconFlow image generation API and return the image URL.
 */
async function callImageAPI(prompt: string): Promise<string> {
  if (!IMAGE_API_KEY) {
    throw new Error("IMAGE_API_KEY (or LLM_API_KEY) is required for image generation");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${IMAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        image_size: "1024x768",
        num_inference_steps: 20,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Image API returned HTTP ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as {
      images?: { url: string }[];
      data?: { url: string }[];
    };

    // SiliconFlow returns `images`, OpenAI-compatible APIs use `data`
    const imageUrl = data.images?.[0]?.url || data.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("Image API returned no image URL");
    }

    return imageUrl;
  } catch (err) {
    if (controller.signal.aborted) {
      const timeoutErr = new Error("图片生成超时，请重试");
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Image download
// ---------------------------------------------------------------------------

/**
 * Download an image from a URL and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  // Basic URL validation — only allow HTTPS from non-private hosts
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error("Image URL must use HTTPS");
    }
    const host = parsed.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new Error("Image URL points to a private network");
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error("Invalid image URL");
    }
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    // Guard against oversized responses (10 MB sanity limit)
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error("Image too large");
    }

    const arrayBuffer = await response.arrayBuffer();

    // Post-download size check (covers chunked responses without Content-Length)
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Image too large");
    }

    return Buffer.from(arrayBuffer);
  } catch (err) {
    if (controller.signal.aborted) {
      const timeoutErr = new Error("图片下载超时，请重试");
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Pixel sampling
// ---------------------------------------------------------------------------

interface SampledCell {
  /** Average red channel (0–255) */
  r: number;
  /** Average green channel (0–255) */
  g: number;
  /** Average blue channel (0–255) */
  b: number;
  /** Computed luminance (0–1, where 0 = black, 1 = white) */
  luminance: number;
}

/**
 * Resize image to grid dimensions × sample factor, then compute the
 * average colour in each grid cell.
 *
 * @returns A 2D array [row][col] of sampled cell data.
 */
async function samplePixels(
  imageBuffer: Buffer,
): Promise<SampledCell[][]> {
  const sampledW = GRID_W * SAMPLE_FACTOR; // 56 * 4 = 224
  const sampledH = GRID_H * SAMPLE_FACTOR; // 40 * 4 = 160

  // Resize to exact sampled dimensions and extract raw RGBA pixel data
  const { data, info } = await sharp(imageBuffer)
    .resize(sampledW, sampledH, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // should be 4 (RGBA)

  // Build grid of averaged colours
  const grid: SampledCell[][] = [];

  for (let row = 0; row < GRID_H; row++) {
    const rowCells: SampledCell[] = [];

    for (let col = 0; col < GRID_W; col++) {
      // Average all pixels within this cell's sample block
      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let count = 0;

      const startY = row * SAMPLE_FACTOR;
      const startX = col * SAMPLE_FACTOR;

      for (let dy = 0; dy < SAMPLE_FACTOR; dy++) {
        for (let dx = 0; dx < SAMPLE_FACTOR; dx++) {
          const py = startY + dy;
          const px = startX + dx;
          const idx = (py * sampledW + px) * channels;

          totalR += data[idx];
          totalG += data[idx + 1];
          totalB += data[idx + 2];
          count++;
        }
      }

      const r = totalR / count;
      const g = totalG / count;
      const b = totalB / count;

      // ITU-R BT.601 luminance formula
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      rowCells.push({ r, g, b, luminance });
    }

    grid.push(rowCells);
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Grid → Bricks conversion
// ---------------------------------------------------------------------------

/**
 * Convert a sampled pixel grid into an array of Bricks.
 *
 * - Cells with luminance < BG_THRESHOLD become bricks.
 * - HP is assigned based on luminance ranges (darker = tougher).
 * - Each brick gets a `color` hex string extracted from the image.
 */
function gridToBricks(grid: SampledCell[][]): Brick[] {
  const bricks: Brick[] = [];

  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const cell = grid[row][col];

      // Skip background (bright/white) cells
      if (cell.luminance >= BG_THRESHOLD) continue;

      // Assign HP based on darkness
      let hp: number;
      if (cell.luminance < HP3_THRESHOLD) {
        hp = 3; // Very dark → toughest
      } else if (cell.luminance < HP2_THRESHOLD) {
        hp = 2; // Medium darkness
      } else {
        hp = 1; // Light-ish (but still not background)
      }

      // Convert average colour to hex string
      const color = rgbToHex(
        Math.round(cell.r),
        Math.round(cell.g),
        Math.round(cell.b),
      );

      bricks.push({ row, col, hp, color });
    }
  }

  return bricks;
}

/**
 * Convert RGB values (0–255) to a hex colour string like "#ff8800".
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Level from a user prompt using image generation + pixel sampling.
 *
 * Steps:
 *   1. Wrap user prompt in pixel-art template
 *   2. Call image generation API
 *   3. Download the generated image
 *   4. Resize & sample pixels into grid cells
 *   5. Convert dark cells to bricks with colour + HP
 *   6. Return a complete Level object
 */
export async function generateFromImage(prompt: string): Promise<Level> {
  // Step 1: Build the pixel-art prompt
  const imagePrompt = buildImagePrompt(prompt);
  console.log(`[generate-image] Prompt: "${imagePrompt}"`);

  // Step 2: Call image API
  const imageUrl = await callImageAPI(imagePrompt);
  console.log(`[generate-image] Got image URL: ${imageUrl.slice(0, 80)}...`);

  // Step 3: Download image
  const imageBuffer = await downloadImage(imageUrl);
  console.log(`[generate-image] Downloaded ${imageBuffer.length} bytes`);

  // Step 4: Sample pixels
  const sampledGrid = await samplePixels(imageBuffer);

  // Step 5: Convert to bricks
  const bricks = gridToBricks(sampledGrid);
  console.log(`[generate-image] Generated ${bricks.length} bricks`);

  // Step 6: Build Level object via shared builder
  return buildLevel(bricks, prompt, GRID_W, GRID_H);
}
