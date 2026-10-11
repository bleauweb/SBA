import { describe, expect, it } from 'vitest';
import { SYMBOLS, symbolFor } from './symbols';
import { formatRow, runsForRow } from './wordchart';

describe('symbols', () => {
  it('are unique and avoid look-alikes', () => {
    expect(new Set(SYMBOLS).size).toBe(SYMBOLS.length);
    for (const bad of ['I', 'l', '1', 'O', '0', 'o', 'i', 'j']) expect(SYMBOLS).not.toContain(bad);
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(60);
  });
  it('keeps going past the table', () => {
    expect(symbolFor(0)).toBe('A');
    expect(symbolFor(SYMBOLS.length + 1)).toBe('BB');
  });
});

describe('word chart', () => {
  it('run-length encodes a row', () => {
    const cells = [0, 0, 1, 1, 1, 0, 2, 2, 2, 2];
    const runs = runsForRow(cells, 5, 1);
    expect(runs).toEqual([{ index: 0, count: 1 }, { index: 2, count: 4 }]);
    expect(formatRow(runsForRow(cells, 5, 0), (i) => 'ABC'[i])).toBe('2×A, 3×B');
  });
});
