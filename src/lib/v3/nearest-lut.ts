import { oklabSqDist, srgbToOklab, type Oklab } from "./oklab";
import { paletteSignature, type Rgb } from "./palette";

/** 6 bits/channel → 64³ = 262,144 entries. */
export const LUT_BITS = 6;
export const LUT_SIZE = 1 << LUT_BITS; // 64
const LUT_MAX = LUT_SIZE - 1;
const SHIFT = 8 - LUT_BITS; // 2

export type NearestLut = {
  /** Packed r*SIZE*SIZE + g*SIZE + b → palette index. */
  lut: Uint8Array;
  /** Median nearest-neighbour distance in sRGB 0–1 Euclidean space. */
  medianStep: number;
  signature: string;
};

const cellCenterByte = (cell: number): number =>
  Math.min(255, Math.round(((cell + 0.5) / LUT_SIZE) * 255));

const buildLutUncached = (palette: readonly Rgb[]): NearestLut => {
  if (palette.length === 0) {
    throw new Error("Palette must contain at least one colour");
  }
  if (palette.length > 256) {
    throw new Error("Palette supports at most 256 colours");
  }

  const labPalette: Oklab[] = palette.map((c) => srgbToOklab(c[0], c[1], c[2]));
  const lut = new Uint8Array(LUT_SIZE * LUT_SIZE * LUT_SIZE);

  for (let r = 0; r < LUT_SIZE; r++) {
    const rb = cellCenterByte(r);
    for (let g = 0; g < LUT_SIZE; g++) {
      const gb = cellCenterByte(g);
      for (let b = 0; b < LUT_SIZE; b++) {
        const bb = cellCenterByte(b);
        const lab = srgbToOklab(rb, gb, bb);
        let best = 0;
        let bestDist = Infinity;
        for (let p = 0; p < labPalette.length; p++) {
          const d = oklabSqDist(lab, labPalette[p]);
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }
        lut[(r * LUT_SIZE + g) * LUT_SIZE + b] = best;
      }
    }
  }

  // Median distance to nearest other palette entry (sRGB 0–1).
  const nnDists: number[] = [];
  for (let i = 0; i < palette.length; i++) {
    const a = palette[i];
    let min = Infinity;
    for (let j = 0; j < palette.length; j++) {
      if (i === j) continue;
      const b = palette[j];
      const dr = (a[0] - b[0]) / 255;
      const dg = (a[1] - b[1]) / 255;
      const db = (a[2] - b[2]) / 255;
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      if (d < min) min = d;
    }
    if (Number.isFinite(min)) nnDists.push(min);
  }
  nnDists.sort((x, y) => x - y);
  const medianStep =
    nnDists.length === 0
      ? 1
      : nnDists.length % 2 === 1
        ? nnDists[(nnDists.length - 1) >> 1]
        : (nnDists[nnDists.length / 2 - 1] + nnDists[nnDists.length / 2]) / 2;

  return {
    lut,
    medianStep: Math.max(1 / 255, medianStep),
    signature: paletteSignature(palette),
  };
};

const lutCache = new Map<string, NearestLut>();

export const getNearestLut = (palette: readonly Rgb[]): NearestLut => {
  const key = paletteSignature(palette);
  const hit = lutCache.get(key);
  if (hit) return hit;
  const built = buildLutUncached(palette);
  lutCache.set(key, built);
  return built;
};

/** Clear cache (tests). */
export const clearNearestLutCache = (): void => {
  lutCache.clear();
};

export const lutIndexFromBytes = (r: number, g: number, b: number): number => {
  const ri = Math.max(0, Math.min(LUT_MAX, r >> SHIFT));
  const gi = Math.max(0, Math.min(LUT_MAX, g >> SHIFT));
  const bi = Math.max(0, Math.min(LUT_MAX, b >> SHIFT));
  return (ri * LUT_SIZE + gi) * LUT_SIZE + bi;
};
