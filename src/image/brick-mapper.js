// src/image/brick-mapper.js
// Provides: BrickMapper
// Depends: MedianCut

class BrickMapper {

  /**
   * Convert an ImageData object to a level descriptor.
   * @param {ImageData} imageData - Raw pixel data from a canvas context.
   * @param {number}    gridWidth - Number of brick columns (default 20).
   * @param {number}    gridHeight - Number of brick rows (default 14).
   * @returns {object}  Level descriptor with name, bricks[], and settings.
   */
  static imageToLevel(imageData, gridWidth = 56, gridHeight = 40) {
    const { width, height, data } = imageData;

    // Dimensions of one grid cell in source-pixel space
    const cellW = width / gridWidth;
    const cellH = height / gridHeight;

    const gridPixels = []; // [row][col] = [r, g, b]
    const allPixels = [];  // flat list for palette extraction

    // --- Sample: compute average color per grid cell ---
    for (let r = 0; r < gridHeight; r++) {
      gridPixels[r] = [];
      for (let c = 0; c < gridWidth; c++) {
        let avgR = 0, avgG = 0, avgB = 0, count = 0;

        const startX = Math.floor(c * cellW);
        const startY = Math.floor(r * cellH);
        const endX   = Math.floor((c + 1) * cellW);
        const endY   = Math.floor((r + 1) * cellH);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const idx = (py * width + px) * 4;
            avgR += data[idx];
            avgG += data[idx + 1];
            avgB += data[idx + 2];
            count++;
          }
        }

        if (count > 0) {
          avgR = Math.round(avgR / count);
          avgG = Math.round(avgG / count);
          avgB = Math.round(avgB / count);
        }

        gridPixels[r][c] = [avgR, avgG, avgB];
        allPixels.push([avgR, avgG, avgB]);
      }
    }

    // --- Quantize all sampled colors into a compact palette ---
    const palette = MedianCut.quantize(allPixels, 32);

    // --- Map each grid cell to a brick (or skip if near-white) ---
    const bricks = [];

    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        const pixel = gridPixels[r][c];
        const color = MedianCut.closestColor(pixel, palette);

        // Perceived luminance (ITU-R BT.601)
        const luminance =
          (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255;

        // Very bright cells are treated as empty space (background)
        if (luminance > 0.90) continue;

        // All image bricks are hp=1 (one hit to destroy)
        // The fun is in seeing the picture, not grinding through tough bricks
        const hp = 1;

        // Convert [r, g, b] to hex string
        const hexColor =
          '#' +
          color[0].toString(16).padStart(2, '0') +
          color[1].toString(16).padStart(2, '0') +
          color[2].toString(16).padStart(2, '0');

        bricks.push({ row: r, col: c, hp, color: hexColor });
      }
    }

    return {
      name: '自定义 - 图片关卡',
      gridWidth,
      gridHeight,
      ballSpeed: 280,
      paddleWidth: 120,
      bricks,
      lives: 5,
    };
  }
}
