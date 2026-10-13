/** Experiment 7 — palette mixture dithering. */

import { sampleNoise } from "../noise";
import {
  nearestPaletteIndex,
  rgbDistanceSq,
  toProcessResult,
} from "../image-utils";
import type { NoiseKind, ProcessResult, Rgb } from "../types";
import { RGB8_CORNERS } from "./rgb-bitplane";
import { medianCutPalette } from "./gif-indexed";

export type MixtureMode = "nearest" | "two" | "four";

export type PaletteMixtureParams = {
  paletteSource: "rgb8" | "image-8" | "custom";
  customPalette?: Rgb[];
  mode: MixtureMode;
  noiseKind: NoiseKind;
  frequency: number;
  /** Use error diffusion instead of noise selection. */
  useErrorDiffusion: boolean;
};

export const DEFAULT_PALETTE_MIXTURE: PaletteMixtureParams = {
  paletteSource: "image-8",
  mode: "two",
  noiseKind: "white",
  frequency: 1,
  useErrorDiffusion: false,
};

const resolvePalette = (
  source: ImageData,
  params: PaletteMixtureParams,
): Rgb[] => {
  if (params.paletteSource === "rgb8") return [...RGB8_CORNERS];
  if (params.paletteSource === "custom" && params.customPalette?.length)
    return [...params.customPalette];
  return medianCutPalette(source.data, 8);
};

/** Find k nearest palette colours and mixture weights (inverse-distance). */
export const mixtureWeights = (
  r: number,
  g: number,
  b: number,
  palette: readonly Rgb[],
  k: number,
): { indices: number[]; weights: number[] } => {
  const scored = palette.map((c, i) => ({
    i,
    d: Math.sqrt(rgbDistanceSq([r, g, b], c)) + 1e-3,
  }));
  scored.sort((a, b) => a.d - b.d);
  const take = scored.slice(0, Math.min(k, scored.length));
  const inv = take.map((s) => 1 / s.d);
  const sum = inv.reduce((a, b) => a + b, 0);
  return {
    indices: take.map((s) => s.i),
    weights: inv.map((v) => v / sum),
  };
};

/** Select palette index from cumulative weights + noise ∈ [0,1). */
export const selectFromMixture = (
  weights: number[],
  indices: number[],
  noise01: number,
): number => {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (noise01 < acc) return indices[i];
  }
  return indices[indices.length - 1];
};

export const processPaletteMixture = (
  source: ImageData,
  params: PaletteMixtureParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const palette = resolvePalette(source, params);
  const out = new Uint8ClampedArray(src.length);
  const k = params.mode === "nearest" ? 1 : params.mode === "two" ? 2 : 4;

  if (params.useErrorDiffusion) {
    // Quantise with FS using the resolved palette
    const buf = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) buf[i] = src[i];
    const diffuse = (
      x: number,
      y: number,
      ch: number,
      err: number,
      w: number,
    ) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      buf[(y * width + x) * 4 + ch] += err * w;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        const idx = nearestPaletteIndex(buf[o], buf[o + 1], buf[o + 2], palette);
        const c = palette[idx];
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = 255;
        const er = buf[o] - c[0];
        const eg = buf[o + 1] - c[1];
        const eb = buf[o + 2] - c[2];
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
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        const mix = mixtureWeights(src[o], src[o + 1], src[o + 2], palette, k);
        const n = sampleNoise({
          kind: params.noiseKind,
          seed: 22222,
          x,
          y,
          width,
          frequency: params.frequency,
        });
        const idx =
          k === 1
            ? mix.indices[0]
            : selectFromMixture(mix.weights, mix.indices, n);
        const c = palette[idx];
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = 255;
      }
    }
  }

  return toProcessResult(out, width, height, {
    reconstructionRadius: 3,
    paletteOverride: palette,
  });
};

/** Probe a single pixel for the mixture UI. */
export const probeMixturePixel = (
  source: ImageData,
  params: PaletteMixtureParams,
  px: number,
  py: number,
) => {
  const palette = resolvePalette(source, params);
  const k = params.mode === "nearest" ? 1 : params.mode === "two" ? 2 : 4;
  const x = Math.max(0, Math.min(source.width - 1, px));
  const y = Math.max(0, Math.min(source.height - 1, py));
  const o = (y * source.width + x) * 4;
  const r = source.data[o];
  const g = source.data[o + 1];
  const b = source.data[o + 2];
  const mix = mixtureWeights(r, g, b, palette, k);
  const noise = sampleNoise({
    kind: params.noiseKind,
    seed: 22222,
    x,
    y,
    width: source.width,
    frequency: params.frequency,
  });
  const selected =
    k === 1
      ? mix.indices[0]
      : selectFromMixture(mix.weights, mix.indices, noise);
  return {
    source: [r, g, b] as Rgb,
    palette,
    indices: mix.indices,
    weights: mix.weights,
    noise,
    selected,
    selectedColor: palette[selected],
  };
};
