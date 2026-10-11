/**
 * Types shared by the server, the SSR/client React code and the PDF renderer.
 * Keep this file free of runtime imports so it can be consumed anywhere.
 */

export type Stitch = 'square'; // 'peyote' | 'brick' arrive in Phase 3

export type PageSize = 'LETTER' | 'A4';

export interface Crop {
  /** Normalized 0–1 coordinates relative to the working image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Calibration {
  /** Measured width of 10 beads sitting side by side in one row, in mm. */
  tenBeadsWidthMm: number;
  /** Measured height of 10 stacked rows, in mm. */
  tenRowsHeightMm: number;
}

export interface GenerationSettings {
  crop: Crop;
  widthBeads: number;
  stitch: Stitch;
  beadSpecId: string;
  maxColors: number;
  finishes: string[];
  /** Restrict matching to these bead ids ("only use these beads"). Undefined = whole line. */
  selectedBeadIds?: string[];
  calibration?: Calibration;
  dither: boolean;
  despeckle: boolean;
  adjust: { brightness: number; contrast: number; saturation: number };
  /** Hex color used to flatten transparent images. */
  background: string;
  pageSize: PageSize;
}

export interface BeadSpec {
  id: string;
  brand: string;
  line: string;
  size: string;
  cellWidthMm: number;
  cellHeightMm: number;
  beadsPerGram: number;
  packageGrams: number;
  whereToBuy: string;
}

export interface BeadColor {
  /** Stable id: `${specId}:${code}` */
  id: string;
  specId: string;
  code: string;
  name: string;
  finish: string;
  hex: string;
  lab: [number, number, number];
  /** Commonly stocked at Michaels stores. Maintained by hand. */
  michaelsCommon?: boolean;
  /** Where the reference colour came from. */
  source?: string;
}

export interface LegendEntry {
  /** Index into Pattern.cells values. */
  index: number;
  symbol: string;
  bead: Omit<BeadColor, 'lab'>;
  count: number;
  grams: number;
  tubes: number;
  /** 'black' | 'white' – whichever is readable on the swatch. */
  textColor: 'black' | 'white';
}

export interface PatternTotals {
  beads: number;
  grams: number;
  widthMm: number;
  heightMm: number;
  warpThreads: number;
  threadMeters: number;
}

export interface Pattern {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
  stitch: Stitch;
  beadSpec: BeadSpec;
  width: number;
  height: number;
  /** Row-major; each value is a LegendEntry.index. */
  cells: number[];
  legend: LegendEntry[];
  totals: PatternTotals;
  settings: GenerationSettings;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  lastAccessedAt: string;
  latestPatternId: string | null;
  thumbnailUrl: string;
}

export interface Project extends ProjectSummary {
  settings: GenerationSettings;
  /** Pixel size of the working image, needed by the crop tool. */
  workingWidth: number;
  workingHeight: number;
  workingImageUrl: string;
}

/** Data passed from the server loader to the page component (and serialized for hydration). */
export type PageData =
  | { page: 'home'; recent: ProjectSummary[]; specs: BeadSpec[] }
  | {
      page: 'project';
      project: Project;
      pattern: Pattern | null;
      canEdit: boolean;
      specs: BeadSpec[];
      finishes: string[];
    }
  | { page: 'pattern'; pattern: Pattern; project: ProjectSummary }
  | { page: 'not-found' };
