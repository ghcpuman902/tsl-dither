/** Experiment 1 — current RGB bit-plane (8 cube corners). */

import { sampleChannelNoise, type NoiseSampleOpts } from "../noise";
import { clampByte, toProcessResult } from "../image-utils";
import type { ChannelCorrelation, NoiseKind, ProcessResult, Rgb } from "../types";

export const RGB8_CORNERS: readonly Rgb[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

export type RgbBitplaneParams = {
  noiseStrength: number; // 0–1
  threshold: number; // 0–1
  noiseKind: NoiseKind;
  frequency: number; // 0.05–1
  correlation: ChannelCorrelation;
  preserveBw: boolean;
  sharedSeed: boolean;
};

export const DEFAULT_RGB_BITPLANE: RgbBitplaneParams = {
  noiseStrength: 0.55,
  threshold: 0.5,
  noiseKind: "white",
  frequency: 1,
  correlation: "independent",
  preserveBw: false,
  sharedSeed: false,
};

export const channelBit = (
  value01: number,
  threshold: number,
  noise01: number,
  strength: number,
): 0 | 1 => {
  const t = Math.max(
    0,
    Math.min(1, threshold + (noise01 - 0.5) * strength),
  );
  return value01 >= t ? 1 : 0;
};

export const processRgbBitplane = (
  source: ImageData,
  params: RgbBitplaneParams,
): ProcessResult => {
  const { data: src, width, height } = source;
  const out = new Uint8ClampedArray(src.length);
  const strength = Math.max(0, Math.min(1, params.noiseStrength));
  const threshold = Math.max(0, Math.min(1, params.threshold));

  const noiseBase: Omit<NoiseSampleOpts, "seed" | "x" | "y"> = {
    kind: params.noiseKind,
    width,
    frequency: params.frequency,
  };

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

      const noise = sampleChannelNoise({
        ...noiseBase,
        x,
        y,
        correlation: params.sharedSeed ? "shared" : params.correlation,
      });

      const br = channelBit(r, threshold, noise.r, strength);
      const bg = channelBit(g, threshold, noise.g, strength);
      const bb = channelBit(b, threshold, noise.b, strength);

      out[o] = br * 255;
      out[o + 1] = bg * 255;
      out[o + 2] = bb * 255;
      out[o + 3] = 255;
    }
  }

  return toProcessResult(out, width, height, {
    reconstructionRadius: 2,
    paletteOverride: [...RGB8_CORNERS],
  });
};

/** Visualise three channel bitmaps as grayscale RGB strips (side by side). */
export const channelBitmapsPreview = (
  source: ImageData,
  params: RgbBitplaneParams,
): ImageData => {
  const result = processRgbBitplane(source, params);
  const { width, height, rgba } = result;
  const stripW = width * 3;
  const out = new Uint8ClampedArray(stripW * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = rgba[si + c];
        const di = (y * stripW + c * width + x) * 4;
        out[di] = out[di + 1] = out[di + 2] = v;
        out[di + 3] = 255;
      }
    }
  }
  return new ImageData(out, stripW, height);
};

export const writeRgbBit = (
  out: Uint8ClampedArray,
  o: number,
  low: number,
  high: number,
  br: 0 | 1,
  bg: 0 | 1,
  bb: 0 | 1,
): void => {
  out[o] = clampByte(br ? high : low);
  out[o + 1] = clampByte(bg ? high : low);
  out[o + 2] = clampByte(bb ? high : low);
  out[o + 3] = 255;
};
