import type { ToneParams, ToneVisible } from "./types";
import {
  SRGB_TO_LINEAR_LUT,
  clampByte,
  linear01ToSrgbByte,
  linearLuminance,
  srgbByteToLinear01,
} from "./color-space";

const clamp = (v: number, min = 0, max = 255): number =>
  Math.max(min, Math.min(max, v));

const toLutIndex = (v: number): number => {
  const rounded = Math.round(v);
  return Math.max(0, Math.min(255, rounded));
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;

  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    default:  h = ((rn - gn) / d + 4) / 6;
  }

  return [h, s, l];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
};

/**
 * Builds a LUT for tonal range adjustments (highlights, shadows, whites, blacks).
 * Applied uniformly across all channels to preserve color balance.
 */
export const buildToneLUT = (params: ToneParams): Uint8Array => {
  const lut = new Uint8Array(256);
  const hlFactor = params.highlights / 100;
  const shFactor = params.shadows / 100;
  const wFactor  = params.whites / 100;
  const bFactor  = params.blacks / 100;

  for (let i = 0; i < 256; i++) {
    let v = srgbByteToLinear01(i);

    // Highlights: affects upper range in linear light.
    if (hlFactor !== 0 && v > 0.5) {
      const blend = (v - 0.5) / 0.5;
      v = Math.max(0, Math.min(1, v + hlFactor * blend * 0.35));
    }

    // Shadows: affects lower half in linear light.
    if (shFactor !== 0 && v < 0.5) {
      const blend = (0.5 - v) / 0.5;
      v = Math.max(0, Math.min(1, v + shFactor * blend * 0.35));
    }

    // Whites: affects near-white in linear light.
    if (wFactor !== 0 && v > 0.8) {
      const blend = (v - 0.8) / 0.2;
      v = Math.max(0, Math.min(1, v + wFactor * blend * 0.2));
    }

    // Blacks: affects near-black in linear light.
    if (bFactor !== 0 && v < 0.25) {
      const blend = (0.25 - v) / 0.25;
      v = Math.max(0, Math.min(1, v + bFactor * blend * 0.2));
    }

    lut[i] = linear01ToSrgbByte(v);
  }

  return lut;
};

const defaultVisible: ToneVisible = {
  exposure: true,
  contrast: true,
  highlights: true,
  shadows: true,
  whites: true,
  blacks: true,
  saturation: true,
  temperature: true,
};

/**
 * Applies all tone adjustments to an ImageData and returns a new ImageData.
 * Uses a separate read buffer so exposure +k then -k is symmetric (no in-place read/write).
 * Processing order: Temperature → Exposure → Contrast → Tonal LUT → Saturation.
 * Steps with toneVisible[key] === false are skipped (Photoshop-style eye).
 */
export const applyTone = (
  imageData: ImageData,
  params: ToneParams,
  toneVisible?: Partial<ToneVisible>,
  outputDither = false
): ImageData => {
  const src = imageData.data;
  const len = src.length;
  const out = new Uint8ClampedArray(len);
  const vis = { ...defaultVisible, ...toneVisible };

  // Round exposure to 2 decimals to avoid slider float noise; ensures +x and -x cancel
  const exposureRounded = Math.round(params.exposure * 100) / 100;
  const expMult = Math.pow(2, exposureRounded);
  const contrastFactor = (100 + params.contrast) / 100;
  const tempShift = params.temperature / 100;
  const satFactor = (100 + params.saturation) / 100;
  const toneLUT = buildToneLUT(params);

  for (let i = 0; i < len; i += 4) {
    let rLin = SRGB_TO_LINEAR_LUT[src[i]];
    let gLin = SRGB_TO_LINEAR_LUT[src[i + 1]];
    let bLin = SRGB_TO_LINEAR_LUT[src[i + 2]];

    if (vis.temperature) {
      const redGain = 1 + tempShift * 0.12;
      const blueGain = 1 - tempShift * 0.12;
      rLin = Math.max(0, Math.min(1, rLin * redGain));
      bLin = Math.max(0, Math.min(1, bLin * blueGain));
    }

    if (vis.exposure) {
      rLin = Math.max(0, Math.min(1, rLin * expMult));
      gLin = Math.max(0, Math.min(1, gLin * expMult));
      bLin = Math.max(0, Math.min(1, bLin * expMult));
    }

    if (vis.contrast) {
      const pivot = 0.18;
      rLin = Math.max(0, Math.min(1, (rLin - pivot) * contrastFactor + pivot));
      gLin = Math.max(0, Math.min(1, (gLin - pivot) * contrastFactor + pivot));
      bLin = Math.max(0, Math.min(1, (bLin - pivot) * contrastFactor + pivot));
    }

    let r = linear01ToSrgbByte(rLin);
    let g = linear01ToSrgbByte(gLin);
    let b = linear01ToSrgbByte(bLin);

    if (vis.highlights || vis.shadows || vis.whites || vis.blacks) {
      r = toneLUT[toLutIndex(r)];
      g = toneLUT[toLutIndex(g)];
      b = toneLUT[toLutIndex(b)];
    }

    if (vis.saturation && satFactor !== 1) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newS = clamp(s * satFactor, 0, 1);
      [r, g, b] = hslToRgb(h, newS, l);
    }

    if (outputDither) {
      const seed = (i >>> 2) * 747796405 + 2891336453;
      const noise = (((seed ^ (seed >>> 16)) & 1023) / 1023 - 0.5) / 255;
      const luma = linearLuminance(SRGB_TO_LINEAR_LUT[r], SRGB_TO_LINEAR_LUT[g], SRGB_TO_LINEAR_LUT[b]);
      const blend = Math.max(0, Math.min(1, (Math.min(luma, 1 - luma) - 0.03) / 0.09));
      const applied = noise * (1 - blend + blend * 0.8);
      r = clampByte(r + applied * 255);
      g = clampByte(g + applied * 255);
      b = clampByte(b + applied * 255);
    }

    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = src[i + 3];
  }

  return new ImageData(out, imageData.width, imageData.height);
};

export type HistogramData = { r: number[]; g: number[]; b: number[] };

/**
 * Computes per-channel frequency histograms from ImageData (256 bins each).
 */
export const computeHistogram = (imageData: ImageData): HistogramData => {
  const r = new Array<number>(256).fill(0);
  const g = new Array<number>(256).fill(0);
  const b = new Array<number>(256).fill(0);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
  }

  return { r, g, b };
};
