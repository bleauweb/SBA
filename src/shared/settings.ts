import { z } from 'zod';
import type { GenerationSettings } from './types';

export const DEFAULT_SPEC_ID = 'toho-11-round';
export const DEFAULT_FINISHES = ['opaque', 'matte', 'ceylon', 'luster'];

export const cropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
  })
  .refine((c) => c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, 'crop exceeds image bounds');

export const settingsSchema = z.object({
  crop: cropSchema,
  widthBeads: z.number().int().min(10).max(400),
  stitch: z.literal('square'),
  beadSpecId: z.string().min(1),
  maxColors: z.number().int().min(2).max(60),
  finishes: z.array(z.string()).min(1),
  selectedBeadIds: z.array(z.string()).min(1).optional(),
  calibration: z
    .object({
      tenBeadsWidthMm: z.number().min(5).max(60),
      tenRowsHeightMm: z.number().min(5).max(60),
    })
    .optional(),
  dither: z.boolean(),
  despeckle: z.boolean(),
  adjust: z.object({
    brightness: z.number().min(-1).max(1),
    contrast: z.number().min(-1).max(1),
    saturation: z.number().min(-1).max(1),
  }),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pageSize: z.enum(['LETTER', 'A4']),
});

/** Partial update accepted by PATCH /api/projects/:id/settings. */
export const settingsPatchSchema = settingsSchema.partial();

export function defaultSettings(): GenerationSettings {
  return {
    crop: { x: 0, y: 0, w: 1, h: 1 },
    widthBeads: 60,
    stitch: 'square',
    beadSpecId: DEFAULT_SPEC_ID,
    maxColors: 12,
    finishes: [...DEFAULT_FINISHES],
    dither: false,
    despeckle: true,
    adjust: { brightness: 0, contrast: 0, saturation: 0 },
    background: '#ffffff',
    pageSize: 'LETTER',
  };
}
