import type { BeadColor, BeadSpec, GenerationSettings, LegendEntry, Pattern } from '../shared/types';
import { hexToRgb, readableTextColor, rgbToLab, type Lab } from './color/color';
import { cropPixelSize, sampleGrid } from './image/sample';
import { symbolFor } from './legend/symbols';
import { despeckle } from './quantize/despeckle';
import { ditherToPalette } from './quantize/dither';
import { kmeans } from './quantize/kmeans';
import { nearestIndex } from './quantize/match';
import { cellGeometry, finishedSizeMm, heightForWidth, loomThreadEstimate } from './stitch/layout';

export interface GenerateInput {
  image: Buffer;
  settings: GenerationSettings;
  spec: BeadSpec;
  /** Beads eligible for matching (already filtered by finish / selection). */
  palette: BeadColor[];
}

export type GeneratedPattern = Omit<Pattern, 'id' | 'projectId' | 'version' | 'createdAt'>;

/** The whole pipeline: image → cells → clusters → beads → legend. Pure apart from sharp decoding. */
export async function generatePattern(input: GenerateInput): Promise<GeneratedPattern> {
  const { settings, spec, palette } = input;
  if (palette.length === 0) throw new Error('no beads available for matching');

  const geom = cellGeometry(spec, settings.calibration);
  const cropPx = await cropPixelSize(input.image, settings.crop);
  const width = settings.widthBeads;
  const height = heightForWidth(settings.stitch, width, cropPx.width / cropPx.height, geom);

  const grid = await sampleGrid(input.image, {
    crop: settings.crop,
    width,
    height,
    background: settings.background,
    adjust: settings.adjust,
  });
  const labs: Lab[] = grid.pixels.map(rgbToLab);

  // 1. cluster the cell colours
  const k = Math.min(settings.maxColors, palette.length);
  const { centroids } = kmeans(labs, null, k, { seed: 20250101 });

  // 2. snap each centroid to a bead; merge duplicates, keep order of first appearance
  const candidates = palette.map((b) => ({ id: b.id, lab: b.lab }));
  const chosenIdx: number[] = [];
  for (const c of centroids) {
    const idx = nearestIndex(c, candidates);
    if (!chosenIdx.includes(idx)) chosenIdx.push(idx);
  }
  const chosen = chosenIdx.map((i) => palette[i]);
  const chosenLabs = chosen.map((b) => b.lab);

  // 3. assign every cell to the nearest chosen bead (optionally with dithering)
  let assignment: Int32Array;
  if (settings.dither) {
    assignment = ditherToPalette(labs, width, height, chosenLabs);
  } else {
    assignment = new Int32Array(labs.length);
    const chosenCands = chosen.map((b) => ({ id: b.id, lab: b.lab }));
    for (let i = 0; i < labs.length; i++) assignment[i] = nearestIndex(labs[i], chosenCands);
  }

  // 4. clean up stray beads
  if (settings.despeckle && chosen.length > 1) {
    assignment = despeckle(assignment, width, height, chosenLabs, { minCount: 4 });
  }

  // 5. legend, ordered by count, with symbols; re-index cells to legend order
  const counts = new Array<number>(chosen.length).fill(0);
  for (let i = 0; i < assignment.length; i++) counts[assignment[i]]++;
  const order = chosen
    .map((_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || chosen[a].code.localeCompare(chosen[b].code));
  const remap = new Int32Array(chosen.length).fill(-1);
  order.forEach((orig, rank) => (remap[orig] = rank));

  const legend: LegendEntry[] = order.map((orig, rank) => {
    const bead = chosen[orig];
    const { lab: _lab, ...beadNoLab } = bead;
    const grams = counts[orig] / spec.beadsPerGram;
    return {
      index: rank,
      symbol: symbolFor(rank),
      bead: beadNoLab,
      count: counts[orig],
      grams: Math.round(grams * 100) / 100,
      tubes: Math.max(1, Math.ceil((grams * 1.15) / spec.packageGrams)),
      textColor: readableTextColor(hexToRgb(bead.hex)),
    };
  });

  const cells: number[] = new Array(assignment.length);
  for (let i = 0; i < assignment.length; i++) cells[i] = remap[assignment[i]];

  const size = finishedSizeMm(settings.stitch, width, height, geom);
  const thread = loomThreadEstimate(width, height, size);
  const totalBeads = width * height;

  return {
    stitch: settings.stitch,
    beadSpec: spec,
    width,
    height,
    cells,
    legend,
    totals: {
      beads: totalBeads,
      grams: Math.round((totalBeads / spec.beadsPerGram) * 100) / 100,
      widthMm: Math.round(size.widthMm * 10) / 10,
      heightMm: Math.round(size.heightMm * 10) / 10,
      warpThreads: thread.warpThreads,
      threadMeters: thread.threadMeters,
    },
    settings: structuredClone(settings),
  };
}
