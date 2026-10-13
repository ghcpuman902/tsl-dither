import type { CropRect, PaletteStats, ProcessResult, Rgb } from "./types";
import { oklabChroma, oklabSqDist, srgbLuma, srgbToOklab } from "./oklab";

export const clampByte = (v: number): number =>
  Math.max(0, Math.min(255, Math.round(v)));

export const rgbKey = (r: number, g: number, b: number): number =>
  ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);

export const extractPalette = (
  rgba: Uint8ClampedArray,
  maxColors = 256,
): Rgb[] => {
  const counts = new Map<number, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    const key = rgbKey(rgba[i], rgba[i + 1], rgba[i + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const colors: Rgb[] = [];
  for (let i = 0; i < sorted.length && colors.length < maxColors; i++) {
    const key = sorted[i][0];
    colors.push([(key >> 16) & 255, (key >> 8) & 255, key & 255]);
  }
  return colors;
};

export const computePaletteStats = (
  source: Uint8ClampedArray,
  result: Uint8ClampedArray,
): PaletteStats => {
  const colors = extractPalette(result);
  let lumaErr = 0;
  let percErr = 0;
  let chromaSum = 0;
  const n = source.length / 4;
  for (let i = 0; i < source.length; i += 4) {
    const sr = source[i];
    const sg = source[i + 1];
    const sb = source[i + 2];
    const rr = result[i];
    const rg = result[i + 1];
    const rb = result[i + 2];
    lumaErr += Math.abs(srgbLuma(sr, sg, sb) - srgbLuma(rr, rg, rb));
    const a = srgbToOklab(sr, sg, sb);
    const b = srgbToOklab(rr, rg, rb);
    percErr += Math.sqrt(oklabSqDist(a, b));
    chromaSum += oklabChroma(b);
  }
  return {
    colors,
    uniqueCount: colors.length,
    averageChroma: chromaSum / n,
    luminanceError: lumaErr / n / 255,
    perceptualError: percErr / n,
  };
};

/** Box-blur reconstruction for local-average preview. */
export const localAverage = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(rgba.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const o = (yy * width + xx) * 4;
          sr += rgba[o];
          sg += rgba[o + 1];
          sb += rgba[o + 2];
          count++;
        }
      }
      const o = (y * width + x) * 4;
      out[o] = Math.round(sr / count);
      out[o + 1] = Math.round(sg / count);
      out[o + 2] = Math.round(sb / count);
      out[o + 3] = 255;
    }
  }
  return out;
};

export const toProcessResult = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: {
    reconstructionRadius?: number;
    extras?: Record<string, unknown>;
    paletteOverride?: Rgb[];
  },
): ProcessResult => {
  const palette = opts?.paletteOverride ?? extractPalette(rgba);
  return {
    rgba,
    width,
    height,
    palette,
    uniqueCount: palette.length,
    reconstruction:
      opts?.reconstructionRadius != null
        ? localAverage(rgba, width, height, opts.reconstructionRadius)
        : undefined,
    extras: opts?.extras,
  };
};

/** Pixel bounds for a normalised crop. */
export const cropToPixels = (
  width: number,
  height: number,
  crop: CropRect,
): { x0: number; y0: number; x1: number; y1: number; size: number } => {
  const minDim = Math.min(width, height);
  const size = Math.max(4, Math.round(crop.half * 2 * minDim));
  const cx = Math.round(crop.cx * width);
  const cy = Math.round(crop.cy * height);
  const x0 = Math.max(0, Math.min(width - size, cx - Math.floor(size / 2)));
  const y0 = Math.max(0, Math.min(height - size, cy - Math.floor(size / 2)));
  return { x0, y0, x1: x0 + size, y1: y0 + size, size };
};

export const extractCrop = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  crop: CropRect,
): { rgba: Uint8ClampedArray; size: number } => {
  const { x0, y0, size } = cropToPixels(width, height, crop);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = ((y0 + y) * width + (x0 + x)) * 4;
      const di = (y * size + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = 255;
    }
  }
  return { rgba: out, size };
};

export const nearestPaletteIndex = (
  r: number,
  g: number,
  b: number,
  palette: readonly Rgb[],
): number => {
  let best = 0;
  let bestD = Infinity;
  const lab = srgbToOklab(r, g, b);
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const d = oklabSqDist(lab, srgbToOklab(c[0], c[1], c[2]));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

export const rgbDistanceSq = (
  a: Rgb,
  b: Rgb,
): number => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};
