// src/image/median-cut.js
// Provides: MedianCut
// Depends: (none)

class MedianCut {

  /**
   * Quantize an array of [r, g, b] pixels down to at most `maxColors` colors.
   * Returns an array of [r, g, b] representative colors (the palette).
   */
  static quantize(pixels, maxColors = 24) {
    if (pixels.length === 0) return [];

    // Start with a single bucket containing all pixels
    let buckets = [pixels.slice()];

    // Iteratively split the bucket with the largest color range
    while (buckets.length < maxColors) {
      let maxRange = -1;
      let maxIdx = 0;

      // Find the bucket whose dominant channel spans the widest range
      for (let i = 0; i < buckets.length; i++) {
        const range = MedianCut._getRange(buckets[i]);
        if (range.maxRange > maxRange) {
          maxRange = range.maxRange;
          maxIdx = i;
        }
      }

      // No further splitting possible (all buckets are uniform)
      if (maxRange <= 0) break;

      const bucket = buckets[maxIdx];
      const range = MedianCut._getRange(bucket);

      // Sort along the channel with the widest spread
      bucket.sort((a, b) => a[range.channel] - b[range.channel]);

      // Split at the median
      const mid = Math.floor(bucket.length / 2);
      const left = bucket.slice(0, mid);
      const right = bucket.slice(mid);

      // Replace original bucket with the two halves
      buckets.splice(maxIdx, 1, left, right);
    }

    // Compute the average color for each bucket → palette entry
    return buckets
      .filter(b => b.length > 0)
      .map(bucket => {
        const avg = [0, 0, 0];
        for (const p of bucket) {
          avg[0] += p[0];
          avg[1] += p[1];
          avg[2] += p[2];
        }
        return [
          Math.round(avg[0] / bucket.length),
          Math.round(avg[1] / bucket.length),
          Math.round(avg[2] / bucket.length),
        ];
      });
  }

  /**
   * Determine which RGB channel has the largest spread within a bucket,
   * and return that channel index plus the spread value.
   */
  static _getRange(bucket) {
    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;

    for (const p of bucket) {
      if (p[0] < minR) minR = p[0]; if (p[0] > maxR) maxR = p[0];
      if (p[1] < minG) minG = p[1]; if (p[1] > maxG) maxG = p[1];
      if (p[2] < minB) minB = p[2]; if (p[2] > maxB) maxB = p[2];
    }

    const ranges = [maxR - minR, maxG - minG, maxB - minB];
    let channel = 0;
    if (ranges[1] > ranges[0]) channel = 1;
    if (ranges[2] > ranges[channel]) channel = 2;

    return { channel, maxRange: ranges[channel] };
  }

  /**
   * Find the closest color in `palette` to the given `pixel` [r, g, b],
   * using squared Euclidean distance in RGB space.
   */
  static closestColor(pixel, palette) {
    let minDist = Infinity;
    let closest = palette[0];

    for (const c of palette) {
      const dr = pixel[0] - c[0];
      const dg = pixel[1] - c[1];
      const db = pixel[2] - c[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }

    return closest;
  }
}
