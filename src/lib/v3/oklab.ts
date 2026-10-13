/**
 * sRGB ↔ OKLab (Björn Ottosson). Used for perceptual nearest-palette matching.
 * https://bottosson.github.io/posts/oklab/
 */

export type Oklab = readonly [number, number, number];

const srgbByteToLinear = (byte: number): number => {
  const c = Math.max(0, Math.min(255, byte)) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
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

export const oklabSqDist = (a: Oklab, b: Oklab): number => {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
};
