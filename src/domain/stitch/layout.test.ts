import { describe, expect, it } from 'vitest';
import type { BeadSpec } from '../../shared/types';
import { cellGeometry, finishedSizeMm, heightForWidth, loomThreadEstimate } from './layout';

const spec: BeadSpec = {
  id: 't', brand: 'Toho', line: 'Round', size: '11/0', cellWidthMm: 1.5, cellHeightMm: 2.0, beadsPerGram: 110, packageGrams: 8, whereToBuy: '',
};

describe('layout', () => {
  it('derives height from width, aspect and bead geometry', () => {
    const geom = cellGeometry(spec);
    // square crop, beads taller than wide → fewer rows than columns
    expect(heightForWidth('square', 100, 1, geom)).toBe(75);
    // calibration overrides
    const cal = cellGeometry(spec, { tenBeadsWidthMm: 20, tenRowsHeightMm: 20 });
    expect(heightForWidth('square', 100, 1, cal)).toBe(100);
  });
  it('computes finished size and thread', () => {
    const geom = cellGeometry(spec);
    const size = finishedSizeMm('square', 100, 75, geom);
    expect(size).toEqual({ widthMm: 150, heightMm: 150 });
    const t = loomThreadEstimate(100, 75, size);
    expect(t.warpThreads).toBe(101);
    expect(t.threadMeters).toBeGreaterThan(45);
  });
});
