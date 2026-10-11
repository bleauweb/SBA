import type { Lab } from '../color/color';
import { mulberry32 } from './random';

export interface KMeansResult {
  centroids: Lab[];
  /** Cluster index per input point. */
  assignments: Int32Array;
}

function dist2(a: Lab, b: Lab): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

/**
 * Weighted k-means in Lab with k-means++ seeding and a fixed seed.
 * Euclidean distance in Lab is used inside the loop for speed; ΔE2000 is applied
 * afterwards when centroids are matched to catalogue beads.
 */
export function kmeans(points: Lab[], weights: number[] | null, k: number, opts: { seed?: number; maxIter?: number } = {}): KMeansResult {
  const n = points.length;
  if (n === 0) return { centroids: [], assignments: new Int32Array(0) };
  const w = weights ?? new Array<number>(n).fill(1);
  const rand = mulberry32(opts.seed ?? 1234);
  const maxIter = opts.maxIter ?? 40;
  k = Math.max(1, Math.min(k, n));

  // k-means++ seeding
  const centroids: Lab[] = [];
  const d2 = new Float64Array(n).fill(Infinity);
  let first = Math.floor(rand() * n);
  centroids.push([...points[first]] as Lab);
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = dist2(points[i], last);
      if (d < d2[i]) d2[i] = d;
      total += d2[i] * w[i];
    }
    if (total === 0) break; // all points coincide with centroids
    let r = rand() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      r -= d2[i] * w[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...points[chosen]] as Lab);
  }

  const assignments = new Int32Array(n).fill(-1);
  const sums = centroids.map(() => [0, 0, 0, 0]);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(points[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed++;
      }
    }
    for (const s of sums) s[0] = s[1] = s[2] = s[3] = 0;
    for (let i = 0; i < n; i++) {
      const s = sums[assignments[i]];
      const wi = w[i];
      s[0] += points[i][0] * wi;
      s[1] += points[i][1] * wi;
      s[2] += points[i][2] * wi;
      s[3] += wi;
    }
    for (let c = 0; c < centroids.length; c++) {
      const s = sums[c];
      if (s[3] > 0) centroids[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
    if (changed === 0) break;
  }
  return { centroids, assignments };
}
