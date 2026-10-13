/**
 * Deterministic noise fields for Color Lab dithering experiments.
 */

import type { ChannelCorrelation, NoiseKind } from "./types";

export const SEED_R = 12345;
export const SEED_G = 23456;
export const SEED_B = 34567;
export const SEED_SHARED = 11111;

/** Deterministic RNG keyed by seed and index. Returns 0–1. */
export const seededRandom = (seed: number, index: number): number => {
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

export const bayerValue = (
  x: number,
  y: number,
  size: 2 | 4 | 8 = 8,
): number => {
  const matrix = size === 2 ? BAYER_2 : size === 4 ? BAYER_4 : BAYER_8;
  const n = size;
  const cell = matrix[(y % n) * n + (x % n)];
  return (cell + 0.5) / (n * n);
};

/**
 * Approximate blue-noise: high-pass of white by subtracting a neighbour average.
 * Not a true void-and-cluster field, but enough for visual comparison.
 */
export const blueApprox = (
  seed: number,
  x: number,
  y: number,
  width: number,
): number => {
  const i = y * width + x;
  const c = seededRandom(seed, i);
  const r = seededRandom(seed, i + 1);
  const d = seededRandom(seed, i + width);
  const l = seededRandom(seed, Math.max(0, i - 1));
  const u = seededRandom(seed, Math.max(0, i - width));
  const avg = (r + d + l + u) * 0.25;
  return Math.max(0, Math.min(1, 0.5 + (c - avg) * 1.6));
};

export type NoiseSampleOpts = {
  kind: NoiseKind;
  seed: number;
  x: number;
  y: number;
  width: number;
  /** Spatial frequency: 1 = per-pixel, <1 = coarser (scaled up). */
  frequency: number;
  /** Bayer size when kind is ordered. */
  bayerSize?: 2 | 4 | 8;
};

/** Sample a 0–1 noise value at a pixel. */
export const sampleNoise = (opts: NoiseSampleOpts): number => {
  const { kind, seed, x, y, width, frequency } = opts;
  const scale = Math.max(0.05, Math.min(1, frequency));
  const sx = Math.floor(x * scale);
  const sy = Math.floor(y * scale);
  const sw = Math.max(1, Math.ceil(width * scale));
  const idx = sy * sw + sx;

  switch (kind) {
    case "ordered":
      return bayerValue(sx, sy, opts.bayerSize ?? 8);
    case "blue-approx":
      return blueApprox(seed, sx, sy, sw);
    case "scaled":
      return seededRandom(seed, idx);
    case "blurred": {
      // Soften by averaging 3×3 of coarse noise
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += seededRandom(seed, (sy + dy) * sw + (sx + dx));
        }
      }
      return sum / 9;
    }
    case "white":
    default:
      return seededRandom(seed, y * width + x);
  }
};

export type ChannelNoise = { r: number; g: number; b: number };

/**
 * Sample R/G/B noise with controllable channel correlation.
 * correlation 0 = shared, 1 = fully independent.
 */
export const sampleChannelNoise = (
  opts: Omit<NoiseSampleOpts, "seed"> & {
    correlation: ChannelCorrelation | number;
    seedR?: number;
    seedG?: number;
    seedB?: number;
    seedShared?: number;
  },
): ChannelNoise => {
  const shared = sampleNoise({
    ...opts,
    seed: opts.seedShared ?? SEED_SHARED,
  });
  const r = sampleNoise({ ...opts, seed: opts.seedR ?? SEED_R });
  const g = sampleNoise({ ...opts, seed: opts.seedG ?? SEED_G });
  const b = sampleNoise({ ...opts, seed: opts.seedB ?? SEED_B });

  let t: number;
  if (typeof opts.correlation === "number") {
    t = Math.max(0, Math.min(1, opts.correlation));
  } else if (opts.correlation === "shared") {
    t = 0;
  } else if (opts.correlation === "partial") {
    t = 0.45;
  } else {
    t = 1;
  }

  return {
    r: shared * (1 - t) + r * t,
    g: shared * (1 - t) + g * t,
    b: shared * (1 - t) + b * t,
  };
};

/** Fill a Float32Array (length = w*h) with a noise field for visualisation. */
export const fillNoiseField = (
  out: Float32Array,
  width: number,
  height: number,
  opts: Omit<NoiseSampleOpts, "x" | "y" | "width">,
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = sampleNoise({ ...opts, x, y, width });
    }
  }
};
