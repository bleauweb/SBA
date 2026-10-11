import { describe, expect, it } from 'vitest';
import { deltaE2000, hexToRgb, labToRgb, readableTextColor, rgbToHex, rgbToLab } from './color';

describe('sRGB ⇄ Lab', () => {
  it('converts white, black and mid grey', () => {
    const w = rgbToLab([255, 255, 255]);
    expect(w[0]).toBeCloseTo(100, 1);
    expect(Math.abs(w[1])).toBeLessThan(0.05);
    expect(Math.abs(w[2])).toBeLessThan(0.05);
    const k = rgbToLab([0, 0, 0]);
    expect(k[0]).toBeCloseTo(0, 3);
    const g = rgbToLab([119, 119, 119]);
    expect(g[0]).toBeCloseTo(50, 0);
  });

  it('converts pure red to the known Lab value', () => {
    const [L, a, b] = rgbToLab([255, 0, 0]);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('round-trips through Lab', () => {
    for (const rgb of [[12, 200, 77], [255, 128, 0], [30, 30, 30], [200, 190, 250]] as const) {
      const back = labToRgb(rgbToLab([...rgb]));
      expect(back).toEqual([...rgb]);
    }
  });

  it('parses and formats hex', () => {
    expect(hexToRgb('#1a2B3c')).toEqual([26, 43, 60]);
    expect(rgbToHex([26, 43, 60])).toBe('#1a2b3c');
    expect(() => hexToRgb('#12')).toThrow();
  });
});

describe('deltaE2000', () => {
  // Pairs from Sharma, Wu & Dalal (2005) test data.
  const cases: Array<[[number, number, number], [number, number, number], number]> = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  it.each(cases)('%j vs %j → %f', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });
  it('is zero for identical colours', () => {
    expect(deltaE2000([40, 10, -20], [40, 10, -20])).toBe(0);
  });
});

describe('readableTextColor', () => {
  it('picks white on dark and black on light', () => {
    expect(readableTextColor([0, 0, 0])).toBe('white');
    expect(readableTextColor([255, 255, 0])).toBe('black');
    expect(readableTextColor([20, 40, 120])).toBe('white');
  });
});
