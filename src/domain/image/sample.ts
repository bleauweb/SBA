import sharp from 'sharp';
import type { Crop } from '../../shared/types';
import type { RGB } from '../color/color';

export interface SampleOptions {
  crop: Crop;
  width: number;
  height: number;
  background: string;
  adjust: { brightness: number; contrast: number; saturation: number };
}

export interface SampledGrid {
  width: number;
  height: number;
  /** Row-major RGB per cell. */
  pixels: RGB[];
}

/**
 * Crops the working image and resamples it to exactly width×height cells using area
 * averaging, after flattening transparency and applying the user's adjustments.
 */
export async function sampleGrid(image: Buffer, opts: SampleOptions): Promise<SampledGrid> {
  const meta = await sharp(image).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) throw new Error('image has no dimensions');

  const left = Math.max(0, Math.min(iw - 1, Math.round(opts.crop.x * iw)));
  const top = Math.max(0, Math.min(ih - 1, Math.round(opts.crop.y * ih)));
  const cw = Math.max(1, Math.min(iw - left, Math.round(opts.crop.w * iw)));
  const ch = Math.max(1, Math.min(ih - top, Math.round(opts.crop.h * ih)));

  let pipeline = sharp(image)
    .rotate()
    .flatten({ background: opts.background })
    .extract({ left, top, width: cw, height: ch });

  const { brightness, contrast, saturation } = opts.adjust;
  if (brightness !== 0 || saturation !== 0) {
    pipeline = pipeline.modulate({ brightness: 1 + brightness, saturation: 1 + saturation });
  }
  if (contrast !== 0) {
    // linear(a, b): out = a*in + b, pivoting around mid grey
    const a = 1 + contrast;
    pipeline = pipeline.linear(a, 128 * (1 - a));
  }

  const { data } = await pipeline
    .resize(opts.width, opts.height, { fit: 'fill', kernel: 'mitchell' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: RGB[] = new Array(opts.width * opts.height);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  }
  return { width: opts.width, height: opts.height, pixels };
}

/** Width/height of the crop in source pixels (used to derive the pattern height). */
export async function cropPixelSize(image: Buffer, crop: Crop): Promise<{ width: number; height: number }> {
  const meta = await sharp(image).rotate().metadata();
  const iw = meta.width ?? 1;
  const ih = meta.height ?? 1;
  return { width: Math.max(1, Math.round(crop.w * iw)), height: Math.max(1, Math.round(crop.h * ih)) };
}
