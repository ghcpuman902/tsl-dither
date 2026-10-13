/** Experiment 3 — OKLab binary cube (8 states → 8 RGB colours). */

import { sampleChannelNoise } from "../noise";
import { oklabToSrgb, srgbToOklab } from "../oklab";
import { toProcessResult } from "../image-utils";
import type { ChannelCorrelation, NoiseKind, ProcessResult, Rgb } from "../types";
import { channelBit } from "./rgb-bitplane";

export type OklabCubeParams = {
  noiseStrength: number;
  noiseKind: NoiseKind;
  frequency: number;
  correlation: ChannelCorrelation;
  lLow: number;
  lHigh: number;
  aAmp: number;
  bAmp: number;
  aCentre: number;
  bCentre: number;
  chromaConstraint: number; // 0–1 scale of a/b amp
  preserveSourceL: boolean;
  scaleChromaBySource: boolean;
  preserveBw: boolean;
};

export const DEFAULT_OKLAB_CUBE: OklabCubeParams = {
  noiseStrength: 0.5,
  noiseKind: "white",
  frequency: 1,
  correlation: "independent",
  lLow: 0.15,
  lHigh: 0.88,
  aAmp: 0.08,
  bAmp: 0.08,
  aCentre: 0,
  bCentre: 0,
  chromaConstraint: 1,
  preserveSourceL: false,
  scaleChromaBySource: true,
  preserveBw: true,
};

export const oklabCubeCorners = (params: OklabCubeParams): Rgb[] => {
  const aAmp = params.aAmp * params.chromaConstraint;
  const bAmp = params.bAmp * params.chromaConstraint;
  const corners: Rgb[] = [];
  for (const L of [params.lLow, params.lHigh]) {
    for (const sa of [-1, 1] as const) {
      for (const sb of [-1, 1] as const) {
        corners.push(
          oklabToSrgb(
            L,
            params.aCentre + sa * aAmp,
            params.bCentre + sb * bAmp,
          ),
        );
      }
    }
  }
  // Deduplicate after gamut clip
  const seen = new Set<string>();
  const unique: Rgb[] = [];
  for (const c of corners) {
    const k = `${c[0]},${c[1]},${c[2]}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(c);
    }
  }
  return unique;
};

export const processOklabCube = (
  source: ImageData,
  params: OklabCubeParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const out = new Uint8ClampedArray(src.length);
  const aAmp = params.aAmp * params.chromaConstraint;
  const bAmp = params.bAmp * params.chromaConstraint;
  const strength = Math.max(0, Math.min(1, params.noiseStrength));

  // Precompute the 8 OKLab states and their RGB (shows gamut mapping clearly)
  const states: { L: number; a: number; b: number; rgb: Rgb }[] = [];
  for (const Lbit of [0, 1] as const) {
    for (const abit of [0, 1] as const) {
      for (const bbit of [0, 1] as const) {
        const L = Lbit ? params.lHigh : params.lLow;
        const a = params.aCentre + (abit ? aAmp : -aAmp);
        const b = params.bCentre + (bbit ? bAmp : -bAmp);
        states.push({ L, a, b, rgb: oklabToSrgb(L, a, b) });
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const o = i * 4;
      const sr = src[o];
      const sg = src[o + 1];
      const sb = src[o + 2];

      if (params.preserveBw) {
        const max = Math.max(sr, sg, sb);
        const min = Math.min(sr, sg, sb);
        if (max < 12) {
          out[o] = out[o + 1] = out[o + 2] = 0;
          out[o + 3] = 255;
          continue;
        }
        if (min > 244) {
          out[o] = out[o + 1] = out[o + 2] = 255;
          out[o + 3] = 255;
          continue;
        }
      }

      const [L, a, b] = srgbToOklab(sr, sg, sb);
      const sourceChroma = Math.sqrt(a * a + b * b);
      const chromaScale = params.scaleChromaBySource
        ? Math.min(1, sourceChroma / 0.12)
        : 1;

      const noise = sampleChannelNoise({
        kind: params.noiseKind,
        width,
        frequency: params.frequency,
        x,
        y,
        correlation: params.correlation,
      });

      // Map L into [0,1] relative to low/high for thresholding
      const lSpan = Math.max(1e-6, params.lHigh - params.lLow);
      const l01 = (L - params.lLow) / lSpan;
      const a01 = 0.5 + a / Math.max(1e-6, aAmp * 2);
      const b01 = 0.5 + b / Math.max(1e-6, bAmp * 2);

      const Lbit = channelBit(l01, 0.5, noise.r, strength);
      const abit = channelBit(a01, 0.5, noise.g, strength * chromaScale);
      const bbit = channelBit(b01, 0.5, noise.b, strength * chromaScale);

      const stateIdx = Lbit * 4 + abit * 2 + bbit;
      let rgb = states[stateIdx].rgb;

      if (params.preserveSourceL) {
        // Re-encode with source L but chosen a/b
        const aVal = params.aCentre + (abit ? aAmp : -aAmp) * chromaScale;
        const bVal = params.bCentre + (bbit ? bAmp : -bAmp) * chromaScale;
        rgb = oklabToSrgb(L, aVal, bVal);
      }

      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
  }

  const palette = oklabCubeCorners(params);
  return toProcessResult(out, width, height, {
    reconstructionRadius: 2,
    paletteOverride: palette,
    extras: { stateCount: 8, rgbAfterConvert: palette.length },
  });
};
