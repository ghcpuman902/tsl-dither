/** Experiment 9 — spatial frequency & channel correlation. */

import { fillNoiseField, sampleChannelNoise } from "../noise";
import { toProcessResult } from "../image-utils";
import type {
  ChannelCorrelation,
  NoiseKind,
  ProcessResult,
} from "../types";
import { channelBit } from "./rgb-bitplane";

export type NoiseFrequencyParams = {
  noiseKind: NoiseKind;
  correlation: ChannelCorrelation;
  /** Luminance / overall frequency. */
  lumaFrequency: number;
  /** Chromatic (per-channel offset) frequency — can be lower. */
  chromaFrequency: number;
  noiseStrength: number;
  threshold: number;
  preserveBw: boolean;
  /** Optional: use luminance from shared noise, chroma from independent. */
  splitLumaChroma: boolean;
};

export const DEFAULT_NOISE_FREQUENCY: NoiseFrequencyParams = {
  noiseKind: "white",
  correlation: "independent",
  lumaFrequency: 1,
  chromaFrequency: 0.25,
  noiseStrength: 0.55,
  threshold: 0.5,
  preserveBw: true,
  splitLumaChroma: true,
};

export const processNoiseFrequency = (
  source: ImageData,
  params: NoiseFrequencyParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const out = new Uint8ClampedArray(src.length);
  const strength = Math.max(0, Math.min(1, params.noiseStrength));
  const threshold = Math.max(0, Math.min(1, params.threshold));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const o = i * 4;
      const r = src[o] / 255;
      const g = src[o + 1] / 255;
      const b = src[o + 2] / 255;

      if (params.preserveBw) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max < 0.04) {
          out[o] = out[o + 1] = out[o + 2] = 0;
          out[o + 3] = 255;
          continue;
        }
        if (min > 0.96) {
          out[o] = out[o + 1] = out[o + 2] = 255;
          out[o + 3] = 255;
          continue;
        }
      }

      if (params.splitLumaChroma) {
        const lumaNoise = sampleChannelNoise({
          kind: params.noiseKind,
          width,
          frequency: params.lumaFrequency,
          x,
          y,
          correlation: "shared",
        });
        const chromaNoise = sampleChannelNoise({
          kind: params.noiseKind,
          width,
          frequency: params.chromaFrequency,
          x,
          y,
          correlation: params.correlation,
        });
        // Blend: shared structure + independent chromatic offset
        const nr = lumaNoise.r * 0.65 + chromaNoise.r * 0.35;
        const ng = lumaNoise.g * 0.65 + chromaNoise.g * 0.35;
        const nb = lumaNoise.b * 0.65 + chromaNoise.b * 0.35;
        out[o] = channelBit(r, threshold, nr, strength) * 255;
        out[o + 1] = channelBit(g, threshold, ng, strength) * 255;
        out[o + 2] = channelBit(b, threshold, nb, strength) * 255;
      } else {
        const noise = sampleChannelNoise({
          kind: params.noiseKind,
          width,
          frequency: params.lumaFrequency,
          x,
          y,
          correlation: params.correlation,
        });
        out[o] = channelBit(r, threshold, noise.r, strength) * 255;
        out[o + 1] = channelBit(g, threshold, noise.g, strength) * 255;
        out[o + 2] = channelBit(b, threshold, noise.b, strength) * 255;
      }
      out[o + 3] = 255;
    }
  }

  return toProcessResult(out, width, height, {
    reconstructionRadius: 2,
  });
};

/** Build RGB visualisation of three noise fields. */
export const noiseFieldsPreview = (
  width: number,
  height: number,
  params: NoiseFrequencyParams,
): ImageData => {
  const rField = new Float32Array(width * height);
  const gField = new Float32Array(width * height);
  const bField = new Float32Array(width * height);

  fillNoiseField(rField, width, height, {
    kind: params.noiseKind,
    seed: 12345,
    frequency: params.chromaFrequency,
  });
  fillNoiseField(gField, width, height, {
    kind: params.noiseKind,
    seed: 23456,
    frequency: params.chromaFrequency,
  });
  fillNoiseField(bField, width, height, {
    kind: params.noiseKind,
    seed: 34567,
    frequency: params.chromaFrequency,
  });

  // Side-by-side: R | G | B | combined tint
  const stripW = width * 4;
  const out = new Uint8ClampedArray(stripW * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const rv = Math.round(rField[i] * 255);
      const gv = Math.round(gField[i] * 255);
      const bv = Math.round(bField[i] * 255);

      const writeGray = (ox: number, v: number) => {
        const o = (y * stripW + ox + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = v;
        out[o + 3] = 255;
      };
      writeGray(0, rv);
      writeGray(width, gv);
      writeGray(width * 2, bv);
      const o = (y * stripW + width * 3 + x) * 4;
      out[o] = rv;
      out[o + 1] = gv;
      out[o + 2] = bv;
      out[o + 3] = 255;
    }
  }
  return new ImageData(out, stripW, height);
};
