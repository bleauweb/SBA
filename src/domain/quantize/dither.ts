import { deltaE2000, type Lab } from '../color/color';

/**
 * Floyd–Steinberg error diffusion in Lab, restricted to a fixed set of bead colours.
 * Returns the chosen palette index per cell (row-major).
 */
export function ditherToPalette(cells: Lab[], width: number, height: number, palette: Lab[]): Int32Array {
  const out = new Int32Array(width * height);
  const work = cells.map((c) => [...c] as Lab);
  const nearest = (lab: Lab): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const d = deltaE2000(lab, palette[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const push = (x: number, y: number, err: Lab, f: number) => {
    if (x < 0 || x >= width || y >= height) return;
    const p = work[y * width + x];
    p[0] += err[0] * f;
    p[1] += err[1] * f;
    p[2] += err[2] * f;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = nearest(work[i]);
      out[i] = idx;
      const chosen = palette[idx];
      const err: Lab = [work[i][0] - chosen[0], work[i][1] - chosen[1], work[i][2] - chosen[2]];
      push(x + 1, y, err, 7 / 16);
      push(x - 1, y + 1, err, 3 / 16);
      push(x, y + 1, err, 5 / 16);
      push(x + 1, y + 1, err, 1 / 16);
    }
  }
  return out;
}
