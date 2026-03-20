import type { DitherParams, DitherMethod } from "./types";

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

/**
 * Binary threshold for a single channel value: 255 if v/255 >= threshold01 else 0.
 */
const binaryThreshold = (v: number, threshold01: number): number =>
  v / 255 >= threshold01 ? 255 : 0;

/**
 * White noise: threshold with a random offset per pixel so density increases
 * how much the cutoff varies (density 0 = pure threshold, higher = noisier).
 * threshold01 = base cutoff; density 0–100 scales (random - 0.5) added to threshold.
 */
const whiteNoiseBinary = (
  v: number,
  threshold01: number,
  density01: number,
  pixelIndex: number
): number => {
  const r = seededRandom(12345, pixelIndex);
  const noise = (r - 0.5) * density01;
  const t = Math.max(0, Math.min(1, threshold01 + noise));
  return v / 255 >= t ? 255 : 0;
};

/**
 * Run a binary dither on a single channel (0–255 values). Reads from src, writes 0 or 255 into out.
 */
const ditherChannel = (
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
        outVal = binaryThreshold(v, threshold01);
        break;
      case "white-noise":
        outVal = whiteNoiseBinary(v, threshold01, density01, i);
        break;
      // TODO: Bayer — ordered dither with precomputed matrix; grid size from params.bayerSize; apply per channel and recombine.
      case "bayer":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Atkinson — error diffusion with fraction 1/8; per-channel binary then recombine.
      case "atkinson":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Burkes — error diffusion (3-4-3 row); per-channel binary then recombine.
      case "burkes":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Floyd–Steinberg — classic error diffusion; per-channel binary then recombine.
      case "floyd-steinberg":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Jarvis, Judice & Ninke — 3-row error diffusion; per-channel binary then recombine.
      case "jjn":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Sierra — Sierra 2-4-8 or similar; per-channel binary then recombine.
      case "sierra":
        outVal = binaryThreshold(v, threshold01);
        break;
      // TODO: Stucki — 5×5 error diffusion; per-channel binary then recombine.
      case "stucki":
        outVal = binaryThreshold(v, threshold01);
        break;
      default:
        outVal = binaryThreshold(v, threshold01);
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

  ditherChannel(src, out, 0, params, method, width, height);
  ditherChannel(src, out, 1, params, method, width, height);
  ditherChannel(src, out, 2, params, method, width, height);

  return new ImageData(out, width, height);
};
