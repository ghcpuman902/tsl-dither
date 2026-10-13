/** Experiment 2 — compressed RGB cube (interior low/high levels). */

import { sampleChannelNoise } from "../noise";
import { clampByte, toProcessResult } from "../image-utils";
import type { ChannelCorrelation, NoiseKind, ProcessResult, Rgb } from "../types";
import { channelBit, writeRgbBit } from "./rgb-bitplane";

export type CompressedRgbParams = {
  noiseStrength: number;
  threshold: number;
  noiseKind: NoiseKind;
  frequency: number;
  correlation: ChannelCorrelation;
  /** 0 = full cube (0/255), 1 = collapsed to centre. */
  compression: number;
  /** Centre of the allowed cube 0–1. */
  centre: number;
  /** Optional max distance from centre (chroma-ish clamp in RGB). */
  chromaLimit: number;
  preserveBw: boolean;
};

export const DEFAULT_COMPRESSED_RGB: CompressedRgbParams = {
  noiseStrength: 0.55,
  threshold: 0.5,
  noiseKind: "white",
  frequency: 1,
  correlation: "independent",
  compression: 0.35,
  centre: 0.5,
  chromaLimit: 1,
  preserveBw: true,
};

export const compressedCubeLevels = (
  compression: number,
  centre: number,
): { low: number; high: number } => {
  const c = Math.max(0, Math.min(1, centre));
  const span = (1 - Math.max(0, Math.min(1, compression))) * 0.5;
  const low = Math.max(0, c - span);
  const high = Math.min(1, c + span);
  return { low: low * 255, high: high * 255 };
};

export const compressedCubeCorners = (
  compression: number,
  centre: number,
): Rgb[] => {
  const { low, high } = compressedCubeLevels(compression, centre);
  const L = clampByte(low);
  const H = clampByte(high);
  return [
    [L, L, L],
    [H, L, L],
    [L, H, L],
    [L, L, H],
    [H, H, L],
    [H, L, H],
    [L, H, H],
    [H, H, H],
  ];
};

export const processCompressedRgb = (
  source: ImageData,
  params: CompressedRgbParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const out = new Uint8ClampedArray(src.length);
  const { low, high } = compressedCubeLevels(
    params.compression,
    params.centre,
  );
  const strength = Math.max(0, Math.min(1, params.noiseStrength));
  const threshold = Math.max(0, Math.min(1, params.threshold));
  const chromaLimit = Math.max(0, Math.min(1, params.chromaLimit));
  const centre01 = params.centre;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const o = i * 4;
      let r = src[o] / 255;
      let g = src[o + 1] / 255;
      let b = src[o + 2] / 255;

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

      // Soft chroma limit: pull toward grey centre before quantising
      if (chromaLimit < 1) {
        const avg = (r + g + b) / 3;
        const t = chromaLimit;
        r = avg + (r - avg) * t;
        g = avg + (g - avg) * t;
        b = avg + (b - avg) * t;
        // Also bias toward cube centre
        r = centre01 + (r - centre01) * t;
        g = centre01 + (g - centre01) * t;
        b = centre01 + (b - centre01) * t;
      }

      const noise = sampleChannelNoise({
        kind: params.noiseKind,
        width,
        frequency: params.frequency,
        x,
        y,
        correlation: params.correlation,
      });

      const br = channelBit(r, threshold, noise.r, strength);
      const bg = channelBit(g, threshold, noise.g, strength);
      const bb = channelBit(b, threshold, noise.b, strength);
      writeRgbBit(out, o, low, high, br, bg, bb);
    }
  }

  const corners = compressedCubeCorners(params.compression, params.centre);
  const palette: Rgb[] = params.preserveBw
    ? [[0, 0, 0], ...corners, [255, 255, 255]]
    : corners;

  return toProcessResult(out, width, height, {
    reconstructionRadius: 2,
    paletteOverride: palette,
  });
};
