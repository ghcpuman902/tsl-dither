/**
 * sRGB ↔ OKLab (Björn Ottosson).
 * https://bottosson.github.io/posts/oklab/
 */

import type { Oklab, Rgb } from "./types";

const srgbByteToLinear = (byte: number): number => {
  const c = Math.max(0, Math.min(255, byte)) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const linearToSrgbByte = (c: number): number => {
  const v = Math.max(0, Math.min(1, c));
  const encoded =
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
};

export const srgbToOklab = (r: number, g: number, b: number): Oklab => {
  const lr = srgbByteToLinear(r);
  const lg = srgbByteToLinear(g);
  const lb = srgbByteToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

export const oklabToSrgb = (L: number, a: number, b: number): Rgb => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [linearToSrgbByte(lr), linearToSrgbByte(lg), linearToSrgbByte(lb)];
};

export const oklabSqDist = (a: Oklab, b: Oklab): number => {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
};

/** Approximate chroma √(a²+b²). */
export const oklabChroma = (lab: Oklab): number =>
  Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);

/** Rec. 709 luma from sRGB bytes. */
export const srgbLuma = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;
