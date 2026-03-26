import type { ToneParams, ToneVisible } from "./types";

const clamp = (v: number, min = 0, max = 255): number =>
  Math.max(min, Math.min(max, v));

const srgbToLinear = (v: number): number => {
  const c = clamp(v, 0, 255) / 255;
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (v: number): number => {
  const c = Math.max(0, Math.min(1, v));
  if (c <= 0.0031308) return c * 12.92 * 255;
  return (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
};

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
    let v = i;

    // Highlights: affects upper half (128–255)
    if (hlFactor !== 0 && v > 128) {
      const blend = (v - 128) / 127;
      v = clamp(v + hlFactor * blend * 80);
    }

    // Shadows: affects lower half (0–128)
    if (shFactor !== 0 && v < 128) {
      const blend = (128 - v) / 128;
      v = clamp(v + shFactor * blend * 80);
    }

    // Whites: affects near-white (200–255)
    if (wFactor !== 0 && v > 200) {
      const blend = (v - 200) / 55;
      v = clamp(v + wFactor * blend * 55);
    }

    // Blacks: affects near-black (0–60)
    if (bFactor !== 0 && v < 60) {
      const blend = (60 - v) / 60;
      v = clamp(v + bFactor * blend * 60);
    }

    lut[i] = Math.round(v);
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
  toneVisible?: Partial<ToneVisible>
): ImageData => {
  const src = imageData.data;
  const len = src.length;
  const out = new Uint8ClampedArray(len);
  const vis = { ...defaultVisible, ...toneVisible };

  // Round exposure to 2 decimals to avoid slider float noise; ensures +x and -x cancel
  const exposureRounded = Math.round(params.exposure * 100) / 100;
  const expMult = Math.pow(2, exposureRounded);
  const contrastFactor = (100 + params.contrast) / 100;
  const tempShift = params.temperature * 0.3;
  const satFactor = (100 + params.saturation) / 100;
  const toneLUT = buildToneLUT(params);

  for (let i = 0; i < len; i += 4) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];

    if (vis.temperature) {
      r = clamp(r + tempShift);
      b = clamp(b - tempShift);
    }

    if (vis.exposure) {
      // Exposure in linear-light space avoids harsh posterization after downsize.
      const rLin = srgbToLinear(r) * expMult;
      const gLin = srgbToLinear(g) * expMult;
      const bLin = srgbToLinear(b) * expMult;
      r = clamp(linearToSrgb(rLin));
      g = clamp(linearToSrgb(gLin));
      b = clamp(linearToSrgb(bLin));
    }

    if (vis.contrast) {
      r = clamp((r - 128) * contrastFactor + 128);
      g = clamp((g - 128) * contrastFactor + 128);
      b = clamp((b - 128) * contrastFactor + 128);
    }

    if (vis.highlights || vis.shadows || vis.whites || vis.blacks) {
      // Tone LUT requires integer indices; float indexing produces undefined bins.
      r = toneLUT[toLutIndex(r)];
      g = toneLUT[toLutIndex(g)];
      b = toneLUT[toLutIndex(b)];
    }

    if (vis.saturation && satFactor !== 1) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newS = clamp(s * satFactor, 0, 1);
      [r, g, b] = hslToRgb(h, newS, l);
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
