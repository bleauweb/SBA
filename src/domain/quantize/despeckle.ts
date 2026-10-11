import { deltaE2000, type Lab } from '../color/color';

/**
 * Removes isolated single beads: a cell whose four neighbours all differ from it is
 * re-assigned to the neighbour colour closest to its own. Runs until stable or `maxPasses`.
 * Colours that cover fewer than `minCount` cells in total are also dissolved into their
 * nearest neighbours, since a bead colour used three times isn't worth buying a tube for.
 */
export function despeckle(
  cells: Int32Array,
  width: number,
  height: number,
  palette: Lab[],
  opts: { minCount?: number; maxPasses?: number } = {},
): Int32Array {
  const out = Int32Array.from(cells);
  const minCount = opts.minCount ?? 4;
  const maxPasses = opts.maxPasses ?? 4;
  const n = palette.length;
  const dist: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => deltaE2000(palette[i], palette[j])));

  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? -1 : out[y * width + x]);

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = 0;
    const counts = new Array<number>(n).fill(0);
    for (let i = 0; i < out.length; i++) counts[out[i]]++;
    const rare = new Set<number>();
    for (let c = 0; c < n; c++) if (counts[c] > 0 && counts[c] < minCount) rare.add(c);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const me = out[i];
        const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((v) => v >= 0);
        if (nb.length === 0) continue;
        const isolated = nb.every((v) => v !== me);
        if (!isolated && !rare.has(me)) continue;
        let best = -1;
        let bestD = Infinity;
        for (const v of nb) {
          if (v === me) continue;
          const d = dist[me][v];
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
        if (best >= 0 && best !== me) {
          out[i] = best;
          changed++;
        }
      }
    }
    if (changed === 0) break;
  }
  return out;
}
