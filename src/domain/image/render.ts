import sharp from 'sharp';
import { hexToRgb } from '../color/color';

/**
 * Renders a pattern to a PNG: each cell becomes a `scale`×`scale` block of its bead colour,
 * optionally with a thin dark grid line. Used for thumbnails and the PDF cover.
 */
export async function renderPatternPng(opts: {
  width: number;
  height: number;
  cells: ArrayLike<number>;
  hexByIndex: string[];
  scale?: number;
  grid?: boolean;
}): Promise<Buffer> {
  const scale = Math.max(1, Math.floor(opts.scale ?? 6));
  const grid = opts.grid ?? scale >= 4;
  const W = opts.width * scale;
  const H = opts.height * scale;
  const buf = Buffer.alloc(W * H * 3);
  const rgbs = opts.hexByIndex.map(hexToRgb);
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const [r, g, b] = rgbs[opts.cells[y * opts.width + x]] ?? [255, 0, 255];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const edge = grid && (dx === scale - 1 || dy === scale - 1);
          const o = ((y * scale + dy) * W + (x * scale + dx)) * 3;
          if (edge) {
            buf[o] = Math.round(r * 0.75);
            buf[o + 1] = Math.round(g * 0.75);
            buf[o + 2] = Math.round(b * 0.75);
          } else {
            buf[o] = r;
            buf[o + 1] = g;
            buf[o + 2] = b;
          }
        }
      }
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}
