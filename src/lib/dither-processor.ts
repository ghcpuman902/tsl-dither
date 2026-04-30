import type { DitherParams, DitherMethod } from "./types";
import { SRGB_TO_LINEAR_LUT } from "./color-space";

/**
 * Deterministic RNG keyed by seed and index. Returns 0–1.
 * Same image + params produce the same dither output.
 */
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

const binaryThresholdLinear = (encodedByte: number, threshold01: number): number => {
  const linearValue = SRGB_TO_LINEAR_LUT[encodedByte];
  return linearValue >= threshold01 ? 255 : 0;
};

/**
 * White noise: threshold with a random offset per pixel so density increases
 * how much the cutoff varies (density 0 = pure threshold, higher = noisier).
 * threshold01 = base cutoff; density 0–100 scales (random - 0.5) added to threshold.
 */
const whiteNoiseBinaryLinear = (
  encodedByte: number,
  threshold01: number,
  density01: number,
  pixelIndex: number
): number => {
  const r = seededRandom(12345, pixelIndex);
  const noise = (r - 0.5) * density01;
  const t = Math.max(0, Math.min(1, threshold01 + noise));
  const linearValue = SRGB_TO_LINEAR_LUT[encodedByte];
  return linearValue >= t ? 255 : 0;
};

/** 2×2 Bayer (row-major), values 0..3 — ordered dither thresholds use (v+0.5)/4. */
const BAYER_2: readonly number[] = [0, 2, 3, 1];

/** 4×4 Bayer (row-major), values 0..15 — see e.g. ordered dither references. */
const BAYER_4: readonly number[] = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];

/** 8×8 Bayer (row-major), values 0..63. */
const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39,
  13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

const getBayerMatrix = (size: number): readonly number[] => {
  if (size <= 2) return BAYER_2;
  if (size <= 4) return BAYER_4;
  return BAYER_8;
};

const normalizeBayerSize = (raw: number): 2 | 4 | 8 => {
  if (raw <= 2) return 2;
  if (raw <= 4) return 4;
  return 8;
};

/**
 * Ordered dither: compare normalized channel to cell threshold from Bayer matrix.
 * Inspired by luminance vs matrix threshold in ordered dithering (e.g. Maxime Heckel’s article).
 */
const bayerDitherChannel = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  channelOffset: number,
  width: number,
  height: number,
  bayerSize: number
): void => {
  const n = normalizeBayerSize(bayerSize);
  const matrix = getBayerMatrix(n);
  const denom = n * n;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + channelOffset;
      const v = src[idx];
      const mx = x % n;
      const my = y % n;
      const cell = matrix[my * n + mx];
      const threshold01 = (cell + 0.5) / denom;
      const linear = SRGB_TO_LINEAR_LUT[v];
      out[idx] = linear >= threshold01 ? 255 : 0;
    }
  }
};

/**
 * Point-wise binary dither (threshold, white noise) on a single channel.
 */
const pointDitherChannel = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  channelOffset: number,
  params: DitherParams,
  method: DitherMethod,
  width: number,
  height: number
): void => {
  const threshold01 = params.threshold / 100;
  const density01 = params.density / 100;
  const n = width * height;

  for (let i = 0; i < n; i++) {
    const idx = i * 4 + channelOffset;
    const v = src[idx];
    let outVal: number;

    switch (method) {
      case "threshold":
        outVal = binaryThresholdLinear(v, threshold01);
        break;
      case "white-noise":
        outVal = whiteNoiseBinaryLinear(v, threshold01, density01, i);
        break;
      default:
        outVal = binaryThresholdLinear(v, threshold01);
    }

    out[idx] = outVal;
  }
};

/**
 * Applies the selected binary dither method per channel (R, G, B) and recombines.
 * Input is tone output ImageData; output is ImageData with each channel 0 or 255 (8 colors total).
 */
export const applyDither = (imageData: ImageData, params: DitherParams): ImageData => {
  const { data: src, width, height } = imageData;
  const out = new Uint8ClampedArray(src.length);
  out.set(src);

  const method = params.method;
  if (method === "bayer") {
    bayerDitherChannel(src, out, 0, width, height, params.bayerSize);
    bayerDitherChannel(src, out, 1, width, height, params.bayerSize);
    bayerDitherChannel(src, out, 2, width, height, params.bayerSize);
    return new ImageData(out, width, height);
  }

  pointDitherChannel(src, out, 0, params, method, width, height);
  pointDitherChannel(src, out, 1, params, method, width, height);
  pointDitherChannel(src, out, 2, params, method, width, height);
  return new ImageData(out, width, height);
};
