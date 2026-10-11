import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../shared/settings';
import type { BeadColor, BeadSpec } from '../shared/types';
import { hexToRgb, rgbToLab } from './color/color';
import { generatePattern } from './generate';
import { renderPatternPng } from './image/render';

const spec: BeadSpec = {
  id: 'toho-11-round', brand: 'Toho', line: 'Round', size: '11/0',
  cellWidthMm: 1.45, cellHeightMm: 2.1, beadsPerGram: 110, packageGrams: 8, whereToBuy: 'Michaels',
};

function bead(code: string, name: string, hex: string): BeadColor {
  return { id: `toho-11-round:${code}`, specId: 'toho-11-round', code, name, finish: 'opaque', hex, lab: rgbToLab(hexToRgb(hex)) };
}
const palette = [
  bead('41', 'Opaque White', '#f4f3ee'),
  bead('49', 'Opaque Jet', '#111111'),
  bead('45', 'Opaque Pepper Red', '#c8202a'),
  bead('48', 'Opaque Navy Blue', '#1b2a5c'),
  bead('47', 'Opaque Mint Green', '#79c7a5'),
  bead('42', 'Opaque Dandelion', '#f2c81c'),
];

/** A 200×100 test image: left half red, right half navy, white square in the middle. */
async function fixture(): Promise<Buffer> {
  const red = Buffer.alloc(100 * 100 * 3, 0);
  for (let i = 0; i < 100 * 100; i++) { red[i * 3] = 200; red[i * 3 + 1] = 30; red[i * 3 + 2] = 40; }
  const blue = Buffer.alloc(100 * 100 * 3, 0);
  for (let i = 0; i < 100 * 100; i++) { blue[i * 3] = 30; blue[i * 3 + 1] = 40; blue[i * 3 + 2] = 100; }
  return sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } })
    .composite([
      { input: await sharp(red, { raw: { width: 100, height: 100, channels: 3 } }).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp(blue, { raw: { width: 100, height: 100, channels: 3 } }).png().toBuffer(), left: 100, top: 0 },
      { input: await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ffffff' } }).png().toBuffer(), left: 80, top: 30 },
    ])
    .png()
    .toBuffer();
}

describe('generatePattern', () => {
  it('produces a pattern with the expected colours, counts and size', async () => {
    const image = await fixture();
    const settings = { ...defaultSettings(), widthBeads: 40, maxColors: 6 };
    const p = await generatePattern({ image, settings, spec, palette });
    expect(p.width).toBe(40);
    // 2:1 image, cells are 1.45 wide × 2.1 tall → 40*1.45/2/2.1 ≈ 14 rows
    expect(p.height).toBe(14);
    expect(p.cells).toHaveLength(40 * 14);
    const codes = p.legend.map((l) => l.bead.code).sort();
    expect(codes).toEqual(['41', '45', '48']);
    expect(p.legend.reduce((s, l) => s + l.count, 0)).toBe(40 * 14);
    expect(p.legend[0].count).toBeGreaterThanOrEqual(p.legend[1].count);
    expect(p.legend[0].symbol).toBe('A');
    expect(p.totals.beads).toBe(560);
    expect(p.totals.widthMm).toBeCloseTo(58, 0);
    expect(p.totals.grams).toBeCloseTo(560 / 110, 1);
    for (const l of p.legend) expect(l.tubes).toBeGreaterThanOrEqual(1);
    // the left edge is red, the right edge navy
    const red = p.legend.find((l) => l.bead.code === '45')!.index;
    const navy = p.legend.find((l) => l.bead.code === '48')!.index;
    expect(p.cells[0]).toBe(red);
    expect(p.cells[39]).toBe(navy);
  });

  it('is deterministic', async () => {
    const image = await fixture();
    const settings = { ...defaultSettings(), widthBeads: 30 };
    const a = await generatePattern({ image, settings, spec, palette });
    const b = await generatePattern({ image, settings, spec, palette });
    expect(a.cells).toEqual(b.cells);
    expect(a.legend).toEqual(b.legend);
  });

  it('honours calibration and crop', async () => {
    const image = await fixture();
    const settings = {
      ...defaultSettings(),
      widthBeads: 20,
      crop: { x: 0, y: 0, w: 0.5, h: 1 },
      calibration: { tenBeadsWidthMm: 20, tenRowsHeightMm: 20 },
    };
    const p = await generatePattern({ image, settings, spec, palette });
    expect(p.height).toBe(20); // square crop, square cells
    expect(p.legend.map((l) => l.bead.code)).toContain('45');
    expect(p.legend.map((l) => l.bead.code)).not.toContain('48');
  });

  it('renders a PNG preview', async () => {
    const image = await fixture();
    const p = await generatePattern({ image, settings: { ...defaultSettings(), widthBeads: 20 }, spec, palette });
    const png = await renderPatternPng({ width: p.width, height: p.height, cells: p.cells, hexByIndex: p.legend.map((l) => l.bead.hex), scale: 5 });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(100);
    expect(meta.format).toBe('png');
  });
});
