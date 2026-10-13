/** Experiment 6 — GIF-style indexed palette quantisation. */

import { sampleNoise, bayerValue } from "../noise";
import { nearestPaletteIndex, toProcessResult } from "../image-utils";
import type { NoiseKind, ProcessResult, Rgb } from "../types";

export type GifDitherMode =
  | "nearest"
  | "ordered"
  | "noise"
  | "error-diffusion";

export type GifIndexedParams = {
  paletteSize: 2 | 4 | 8 | 16 | 32 | 256;
  dither: GifDitherMode;
  noiseStrength: number;
  noiseKind: NoiseKind;
  frequency: number;
};

export const DEFAULT_GIF_INDEXED: GifIndexedParams = {
  paletteSize: 8,
  dither: "ordered",
  noiseStrength: 0.45,
  noiseKind: "white",
  frequency: 1,
};

type Bucket = { r: number; g: number; b: number; n: number };

/** Median-cut palette extraction. */
export const medianCutPalette = (
  rgba: Uint8ClampedArray,
  size: number,
): Rgb[] => {
  const pixels: Rgb[] = [];
  // Subsample for speed
  const step = Math.max(1, Math.floor(rgba.length / 4 / 8000));
  for (let i = 0; i < rgba.length; i += 4 * step) {
    pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (pixels.length === 0) return [[0, 0, 0]];

  type Box = { pixels: Rgb[]; };
  let boxes: Box[] = [{ pixels }];

  while (boxes.length < size) {
    let bestIdx = -1;
    let bestRange = -1;
    let bestChannel: 0 | 1 | 2 = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.pixels.length < 2) continue;
      let rMin = 255,
        rMax = 0,
        gMin = 255,
        gMax = 0,
        bMin = 255,
        bMax = 0;
      for (const p of box.pixels) {
        if (p[0] < rMin) rMin = p[0];
        if (p[0] > rMax) rMax = p[0];
        if (p[1] < gMin) gMin = p[1];
        if (p[1] > gMax) gMax = p[1];
        if (p[2] < bMin) bMin = p[2];
        if (p[2] > bMax) bMax = p[2];
      }
      const ranges: [number, 0 | 1 | 2][] = [
        [rMax - rMin, 0],
        [gMax - gMin, 1],
        [bMax - bMin, 2],
      ];
      ranges.sort((a, b) => b[0] - a[0]);
      if (ranges[0][0] > bestRange) {
        bestRange = ranges[0][0];
        bestIdx = i;
        bestChannel = ranges[0][1];
      }
    }
    if (bestIdx < 0) break;
    const box = boxes[bestIdx];
    const ch = bestChannel;
    const sorted = [...box.pixels].sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    boxes = [
      ...boxes.slice(0, bestIdx),
      ...boxes.slice(bestIdx + 1),
      { pixels: left },
      { pixels: right },
    ];
  }

  return boxes.map((box) => {
    const acc: Bucket = { r: 0, g: 0, b: 0, n: 0 };
    for (const p of box.pixels) {
      acc.r += p[0];
      acc.g += p[1];
      acc.b += p[2];
      acc.n++;
    }
    const n = Math.max(1, acc.n);
    return [
      Math.round(acc.r / n),
      Math.round(acc.g / n),
      Math.round(acc.b / n),
    ] as Rgb;
  });
};

const applyNearest = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  palette: readonly Rgb[],
): void => {
  for (let i = 0; i < src.length; i += 4) {
    const idx = nearestPaletteIndex(src[i], src[i + 1], src[i + 2], palette);
    const c = palette[idx];
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  }
};

const applyOrdered = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly Rgb[],
  strength: number,
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const n = (bayerValue(x, y, 8) - 0.5) * strength * 64;
      const idx = nearestPaletteIndex(
        src[o] + n,
        src[o + 1] + n,
        src[o + 2] + n,
        palette,
      );
      const c = palette[idx];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
};

const applyNoiseDither = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly Rgb[],
  params: GifIndexedParams,
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const n =
        (sampleNoise({
          kind: params.noiseKind,
          seed: 12345,
          x,
          y,
          width,
          frequency: params.frequency,
        }) -
          0.5) *
        params.noiseStrength *
        80;
      const idx = nearestPaletteIndex(
        src[o] + n,
        src[o + 1] + n,
        src[o + 2] + n,
        palette,
      );
      const c = palette[idx];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
};

/** Floyd–Steinberg error diffusion. */
const applyErrorDiffusion = (
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly Rgb[],
): void => {
  const buf = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) buf[i] = src[i];

  const diffuse = (x: number, y: number, ch: number, err: number, w: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    buf[(y * width + x) * 4 + ch] += err * w;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const r = buf[o];
      const g = buf[o + 1];
      const b = buf[o + 2];
      const idx = nearestPaletteIndex(r, g, b, palette);
      const c = palette[idx];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
      const er = r - c[0];
      const eg = g - c[1];
      const eb = b - c[2];
      diffuse(x + 1, y, 0, er, 7 / 16);
      diffuse(x + 1, y, 1, eg, 7 / 16);
      diffuse(x + 1, y, 2, eb, 7 / 16);
      diffuse(x - 1, y + 1, 0, er, 3 / 16);
      diffuse(x - 1, y + 1, 1, eg, 3 / 16);
      diffuse(x - 1, y + 1, 2, eb, 3 / 16);
      diffuse(x, y + 1, 0, er, 5 / 16);
      diffuse(x, y + 1, 1, eg, 5 / 16);
      diffuse(x, y + 1, 2, eb, 5 / 16);
      diffuse(x + 1, y + 1, 0, er, 1 / 16);
      diffuse(x + 1, y + 1, 1, eg, 1 / 16);
      diffuse(x + 1, y + 1, 2, eb, 1 / 16);
    }
  }
};

export const processGifIndexed = (
  source: ImageData,
  params: GifIndexedParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const palette = medianCutPalette(src, params.paletteSize);
  const out = new Uint8ClampedArray(src.length);

  switch (params.dither) {
    case "nearest":
      applyNearest(src, out, palette);
      break;
    case "ordered":
      applyOrdered(src, out, width, height, palette, params.noiseStrength);
      break;
    case "noise":
      applyNoiseDither(src, out, width, height, palette, params);
      break;
    case "error-diffusion":
      applyErrorDiffusion(src, out, width, height, palette);
      break;
  }

  return toProcessResult(out, width, height, {
    reconstructionRadius: 2,
    paletteOverride: palette,
  });
};
