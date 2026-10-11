import type { BeadSpec, Calibration, Stitch } from '../../shared/types';

export interface CellGeometry {
  cellWidthMm: number;
  cellHeightMm: number;
}

/** Effective cell size: user calibration wins over the catalogue spec. */
export function cellGeometry(spec: BeadSpec, calibration?: Calibration): CellGeometry {
  if (calibration) {
    return { cellWidthMm: calibration.tenBeadsWidthMm / 10, cellHeightMm: calibration.tenRowsHeightMm / 10 };
  }
  return { cellWidthMm: spec.cellWidthMm, cellHeightMm: spec.cellHeightMm };
}

/**
 * Height in beads that keeps the crop's proportions once beads of the given geometry are
 * laid out. Square stitch / loom: a plain rectangular grid.
 */
export function heightForWidth(stitch: Stitch, widthBeads: number, cropAspect: number, geom: CellGeometry): number {
  void stitch; // only 'square' for now; offset layouts will adjust here
  const h = Math.round((widthBeads * geom.cellWidthMm) / cropAspect / geom.cellHeightMm);
  return Math.max(1, h);
}

export function finishedSizeMm(stitch: Stitch, width: number, height: number, geom: CellGeometry): { widthMm: number; heightMm: number } {
  void stitch;
  return { widthMm: width * geom.cellWidthMm, heightMm: height * geom.cellHeightMm };
}

/**
 * Loom thread estimate in metres: one warp per column plus one, each the pattern height
 * plus 15 cm tails at both ends; weft is roughly 2.5× the pattern width per row.
 */
export function loomThreadEstimate(width: number, height: number, sizeMm: { widthMm: number; heightMm: number }): { warpThreads: number; threadMeters: number } {
  const warpThreads = width + 1;
  const warpMm = warpThreads * (sizeMm.heightMm + 300);
  const weftMm = height * sizeMm.widthMm * 2.5;
  return { warpThreads, threadMeters: Math.round(((warpMm + weftMm) / 1000) * 10) / 10 };
}
