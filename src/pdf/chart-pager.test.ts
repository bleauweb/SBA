import { describe, expect, it } from 'vitest';
import { pageTiles } from './chart-pager';

describe('pageTiles', () => {
  it('uses one tile when the pattern fits', () => {
    const t = pageTiles({ width: 30, height: 20, colsPerPage: 34, rowsPerPage: 44 });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ col0: 0, col1: 30, row0: 0, row1: 20 });
  });
  it('tiles with overlap and covers every cell', () => {
    const t = pageTiles({ width: 100, height: 60, colsPerPage: 34, rowsPerPage: 44, overlap: 2 });
    expect(t[1].col0).toBe(32);
    expect(t[t.length - 1].col1).toBe(100);
    expect(t[t.length - 1].row1).toBe(60);
    const covered = new Set<string>();
    for (const tile of t) for (let r = tile.row0; r < tile.row1; r++) for (let c = tile.col0; c < tile.col1; c++) covered.add(`${c},${r}`);
    expect(covered.size).toBe(100 * 60);
    expect(t.map((x) => x.pageIndex)).toEqual(t.map((_, i) => i));
  });
});
