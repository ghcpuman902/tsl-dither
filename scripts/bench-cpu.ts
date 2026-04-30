import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyTone } from "../src/lib/tone-processor";
import { applyDither } from "../src/lib/dither-processor";
import type { DitherParams, ToneParams } from "../src/lib/types";
import { SRGB_TO_LINEAR_LUT, linear01ToSrgbByte } from "../src/lib/color-space";

class PolyfilledImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as { ImageData: typeof PolyfilledImageData }).ImageData = PolyfilledImageData;
}

type BenchCase = {
  name: string;
  width: number;
  height: number;
};

const CASES: BenchCase[] = [
  { name: "1mp", width: 1024, height: 1024 },
  { name: "4mp", width: 2048, height: 2048 },
  { name: "8mp", width: 3264, height: 2448 },
];

const TONE_PARAMS: ToneParams = {
  exposure: 0.35,
  contrast: 12,
  highlights: -20,
  shadows: 18,
  whites: -8,
  blacks: 10,
  saturation: 6,
  temperature: 8,
};

const DITHER_PARAMS: DitherParams[] = [
  { method: "threshold", threshold: 50, density: 0, bayerSize: 4 },
  { method: "white-noise", threshold: 48, density: 35, bayerSize: 4 },
  { method: "bayer", threshold: 50, density: 0, bayerSize: 8 },
];

const makeImageData = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const xf = x / Math.max(1, width - 1);
      const yf = y / Math.max(1, height - 1);
      data[i] = Math.round(Math.pow(xf, 1.8) * 255);
      data[i + 1] = Math.round(Math.pow((xf + yf) * 0.5, 2.2) * 255);
      data[i + 2] = Math.round(Math.pow(yf, 1.6) * 255);
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
};

const linearDownsizeBilinear = (source: ImageData, targetW: number, targetH: number): ImageData => {
  const out = new Uint8ClampedArray(targetW * targetH * 4);
  const src = source.data;
  const xScale = source.width / targetW;
  const yScale = source.height / targetH;
  for (let y = 0; y < targetH; y++) {
    const sy = (y + 0.5) * yScale - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(source.height - 1, y0 + 1);
    const ty = sy - y0;
    for (let x = 0; x < targetW; x++) {
      const sx = (x + 0.5) * xScale - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(source.width - 1, x0 + 1);
      const tx = sx - x0;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      const i00 = (y0 * source.width + x0) * 4;
      const i10 = (y0 * source.width + x1) * 4;
      const i01 = (y1 * source.width + x0) * 4;
      const i11 = (y1 * source.width + x1) * 4;
      const outIdx = (y * targetW + x) * 4;
      const rLin =
        SRGB_TO_LINEAR_LUT[src[i00]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11]] * w11;
      const gLin =
        SRGB_TO_LINEAR_LUT[src[i00 + 1]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10 + 1]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01 + 1]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11 + 1]] * w11;
      const bLin =
        SRGB_TO_LINEAR_LUT[src[i00 + 2]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10 + 2]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01 + 2]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11 + 2]] * w11;
      out[outIdx] = linear01ToSrgbByte(rLin);
      out[outIdx + 1] = linear01ToSrgbByte(gLin);
      out[outIdx + 2] = linear01ToSrgbByte(bLin);
      out[outIdx + 3] = 255;
    }
  }
  return new ImageData(out, targetW, targetH);
};

const measure = <T>(fn: () => T): { result: T; ms: number } => {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
};

const rows: Record<string, number | string>[] = [];

for (const bench of CASES) {
  const source = makeImageData(bench.width, bench.height);
  const downsize = measure(() => linearDownsizeBilinear(source, Math.floor(bench.width / 2), Math.floor(bench.height / 2)));
  const tone = measure(() => applyTone(downsize.result, TONE_PARAMS, undefined, true));
  const ditherRows = DITHER_PARAMS.map((params) => ({
    params,
    measured: measure(() => applyDither(tone.result, params)),
  }));

  rows.push({
    case: bench.name,
    width: bench.width,
    height: bench.height,
    downsize_ms: Number(downsize.ms.toFixed(2)),
    tone_ms: Number(tone.ms.toFixed(2)),
  });
  for (const { params, measured } of ditherRows) {
    rows.push({
      case: `${bench.name}_${params.method}`,
      width: tone.result.width,
      height: tone.result.height,
      stage: "dither",
      ms: Number(measured.ms.toFixed(2)),
    });
  }
}

const outDir = join(process.cwd(), "bench-results");
mkdirSync(outDir, { recursive: true });
const output = {
  generatedAt: new Date().toISOString(),
  runtime: "cpu",
  rows,
};
writeFileSync(join(outDir, "cpu-baseline.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));

