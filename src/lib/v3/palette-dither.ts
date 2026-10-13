import { getNearestLut, lutIndexFromBytes } from "./nearest-lut";
import type { Rgb } from "./palette";
import type { PaletteDitherParams } from "./types";

/** Per-channel white-noise seeds (match v1/v2). */
const NOISE_SEED_R = 12345;
const NOISE_SEED_G = 23456;
const NOISE_SEED_B = 34567;
const NOISE_SEED_SHARED = 11111;

const seededRandom = (seed: number, index: number): number => {
  let s = (seed * 0x9e3779b9) >>> 0;
  let i = index;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b);
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35);
  s = (s ^ (s >>> 16)) >>> 0;
  i = Math.imul(i ^ (i >>> 16), 0x85ebca6b);
  i = Math.imul(i ^ (i >>> 13), 0xc2b2ae35);
  i = (i ^ (i >>> 16)) >>> 0;
  const t = (s + i) >>> 0;
  return (t & 0x7fffff) / 0x800000;
};

const BAYER_2: readonly number[] = [0, 2, 3, 1];
const BAYER_4: readonly number[] = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];
const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14,
  46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19,
  59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
];

const normalizeBayerSize = (raw: number): 2 | 4 | 8 => {
  if (raw <= 2) return 2;
  if (raw <= 4) return 4;
  return 8;
};

const getBayerMatrix = (size: 2 | 4 | 8): readonly number[] => {
  if (size === 2) return BAYER_2;
  if (size === 4) return BAYER_4;
  return BAYER_8;
};

/** Bayer cell → offset in [-0.5, 0.5]. */
const bayerOffset = (x: number, y: number, size: 2 | 4 | 8): number => {
  const n = size;
  const matrix = getBayerMatrix(n);
  const cell = matrix[(y % n) * n + (x % n)];
  return (cell + 0.5) / (n * n) - 0.5;
};

const clampByte = (v: number): number =>
  Math.max(0, Math.min(255, Math.round(v)));

/**
 * Perturb source colour, then snap to nearest palette entry via LUT.
 * strength 0 = hard nearest match (old threshold); higher = more dither.
 * chroma 0 = shared offset across channels; 100 = independent per channel.
 */
export const applyPaletteDither = (
  imageData: ImageData,
  params: PaletteDitherParams,
): ImageData => {
  const { data: src, width, height } = imageData;
  const out = new Uint8ClampedArray(src.length);
  const palette = params.palette;
  const lutPack = getNearestLut(palette);
  const { lut, medianStep } = lutPack;

  const strength01 = Math.max(0, Math.min(1, params.strength / 100));
  const chroma01 = Math.max(0, Math.min(1, params.chroma / 100));
  // bias −50…50 → level shift in sRGB units, scaled by palette step
  const bias01 = (params.bias / 50) * medianStep * 0.5;
  const amplitude = strength01 * medianStep;
  const bayerSize = normalizeBayerSize(params.bayerSize);
  const n = width * height;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const x = i % width;
    const y = (i / width) | 0;

    let offShared: number;
    let offR: number;
    let offG: number;
    let offB: number;

    if (params.method === "ordered") {
      offShared = bayerOffset(x, y, bayerSize);
      // Slight channel-decorrelated Bayer: shift sample phase
      offR = offShared;
      offG = bayerOffset(x + 1, y, bayerSize);
      offB = bayerOffset(x, y + 1, bayerSize);
    } else {
      offShared = seededRandom(NOISE_SEED_SHARED, i) - 0.5;
      offR = seededRandom(NOISE_SEED_R, i) - 0.5;
      offG = seededRandom(NOISE_SEED_G, i) - 0.5;
      offB = seededRandom(NOISE_SEED_B, i) - 0.5;
    }

    const mixR = offShared * (1 - chroma01) + offR * chroma01;
    const mixG = offShared * (1 - chroma01) + offG * chroma01;
    const mixB = offShared * (1 - chroma01) + offB * chroma01;

    const pr = clampByte(src[o] + (mixR * amplitude + bias01) * 255);
    const pg = clampByte(src[o + 1] + (mixG * amplitude + bias01) * 255);
    const pb = clampByte(src[o + 2] + (mixB * amplitude + bias01) * 255);

    const idx = lut[lutIndexFromBytes(pr, pg, pb)];
    const c: Rgb = palette[idx] ?? palette[0];
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = 255;
  }

  return new ImageData(out, width, height);
};

/**
 * Single-pixel recipe used by the compositor hot loop.
 * Precomputes LUT + amplitude so each pixel is one LUT read.
 */
export type PreparedPaletteRecipe = {
  palette: readonly Rgb[];
  lut: Uint8Array;
  amplitude: number;
  bias01: number;
  chroma01: number;
  method: PaletteDitherParams["method"];
  bayerSize: 2 | 4 | 8;
};

export const preparePaletteRecipe = (
  params: PaletteDitherParams,
): PreparedPaletteRecipe => {
  const lutPack = getNearestLut(params.palette);
  const strength01 = Math.max(0, Math.min(1, params.strength / 100));
  return {
    palette: params.palette,
    lut: lutPack.lut,
    amplitude: strength01 * lutPack.medianStep,
    bias01: (params.bias / 50) * lutPack.medianStep * 0.5,
    chroma01: Math.max(0, Math.min(1, params.chroma / 100)),
    method: params.method,
    bayerSize: normalizeBayerSize(params.bayerSize),
  };
};

export const ditherPixelInto = (
  out: Uint8ClampedArray,
  o: number,
  sr: number,
  sg: number,
  sb: number,
  x: number,
  y: number,
  pixelIndex: number,
  recipe: PreparedPaletteRecipe,
): void => {
  const { amplitude, bias01, chroma01, method, bayerSize, lut, palette } =
    recipe;

  let offShared: number;
  let offR: number;
  let offG: number;
  let offB: number;

  if (method === "ordered") {
    offShared = bayerOffset(x, y, bayerSize);
    offR = offShared;
    offG = bayerOffset(x + 1, y, bayerSize);
    offB = bayerOffset(x, y + 1, bayerSize);
  } else {
    offShared = seededRandom(NOISE_SEED_SHARED, pixelIndex) - 0.5;
    offR = seededRandom(NOISE_SEED_R, pixelIndex) - 0.5;
    offG = seededRandom(NOISE_SEED_G, pixelIndex) - 0.5;
    offB = seededRandom(NOISE_SEED_B, pixelIndex) - 0.5;
  }

  const mixR = offShared * (1 - chroma01) + offR * chroma01;
  const mixG = offShared * (1 - chroma01) + offG * chroma01;
  const mixB = offShared * (1 - chroma01) + offB * chroma01;

  const pr = clampByte(sr + (mixR * amplitude + bias01) * 255);
  const pg = clampByte(sg + (mixG * amplitude + bias01) * 255);
  const pb = clampByte(sb + (mixB * amplitude + bias01) * 255);

  const idx = lut[lutIndexFromBytes(pr, pg, pb)];
  const c = palette[idx] ?? palette[0];
  out[o] = c[0];
  out[o + 1] = c[1];
  out[o + 2] = c[2];
  out[o + 3] = 255;
};
