import { describe, expect, it } from 'vitest';
import type { Lab } from '../color/color';
import { despeckle } from './despeckle';
import { ditherToPalette } from './dither';
import { kmeans } from './kmeans';
import { nearestIndex } from './match';

describe('kmeans', () => {
  it('is deterministic and separates obvious clusters', () => {
    const pts: Lab[] = [];
    for (let i = 0; i < 50; i++) pts.push([10 + (i % 3), 0, 0], [90 + (i % 3), 0, 0]);
    const a = kmeans(pts, null, 2, { seed: 7 });
    const b = kmeans(pts, null, 2, { seed: 7 });
    expect(a.centroids).toEqual(b.centroids);
    const ls = a.centroids.map((c) => Math.round(c[0])).sort((x, y) => x - y);
    expect(ls).toEqual([11, 91]);
    expect(a.assignments[0]).not.toBe(a.assignments[1]);
  });

  it('caps k at the number of points and handles empty input', () => {
    expect(kmeans([], null, 5).centroids).toEqual([]);
    expect(kmeans([[1, 2, 3]], null, 5).centroids).toHaveLength(1);
  });

  it('respects weights', () => {
    const pts: Lab[] = [[0, 0, 0], [100, 0, 0]];
    const r = kmeans(pts, [1000, 1], 1, { seed: 1 });
    expect(r.centroids[0][0]).toBeLessThan(1);
  });
});

describe('nearestIndex', () => {
  it('finds the closest candidate', () => {
    const cands = [
      { id: 'a', lab: [50, 0, 0] as Lab },
      { id: 'b', lab: [80, 0, 0] as Lab },
    ];
    expect(nearestIndex([78, 0, 0], cands)).toBe(1);
    expect(nearestIndex([51, 0, 0], cands)).toBe(0);
  });
});

describe('despeckle', () => {
  it('removes an isolated bead', () => {
    const palette: Lab[] = [[20, 0, 0], [90, 0, 0], [50, 0, 0]];
    // 3x3 of colour 0 with a lone colour 1 in the middle
    const cells = Int32Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const out = despeckle(cells, 3, 3, palette, { minCount: 1 });
    expect(Array.from(out)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('keeps a 2-wide line', () => {
    const palette: Lab[] = [[20, 0, 0], [90, 0, 0]];
    const cells = Int32Array.from([0, 1, 1, 0, 0, 1, 1, 0]);
    const out = despeckle(cells, 4, 2, palette, { minCount: 1 });
    expect(Array.from(out)).toEqual([0, 1, 1, 0, 0, 1, 1, 0]);
  });

  it('dissolves colours used fewer than minCount times', () => {
    const palette: Lab[] = [[20, 0, 0], [90, 0, 0], [85, 0, 0]];
    const cells = Int32Array.from([0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    const out = despeckle(cells, 4, 4, palette, { minCount: 3 });
    expect(Array.from(out)).not.toContain(2);
    expect(Array.from(out).filter((v) => v === 1).length).toBeGreaterThanOrEqual(6);
  });
});

describe('ditherToPalette', () => {
  it('produces a mix of two palette colours for a mid grey', () => {
    const palette: Lab[] = [[0, 0, 0], [100, 0, 0]];
    const cells: Lab[] = new Array(100).fill([50, 0, 0]);
    const out = ditherToPalette(cells, 10, 10, palette);
    const ones = Array.from(out).filter((v) => v === 1).length;
    expect(ones).toBeGreaterThan(30);
    expect(ones).toBeLessThan(70);
  });
});
