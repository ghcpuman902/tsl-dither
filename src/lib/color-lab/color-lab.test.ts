import { describe, expect, it } from "vitest";
import { processCompressedRgb } from "./experiments/compressed-rgb";
import { processGifIndexed } from "./experiments/gif-indexed";
import { processOklabCube } from "./experiments/oklab-cube";
import { processRgbBitplane } from "./experiments/rgb-bitplane";
import { oklabToSrgb, srgbToOklab } from "./oklab";
import { extractPalette } from "./image-utils";

const makeGradient = (w = 64, h = 64): ImageData => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = Math.round((x / (w - 1)) * 255);
      data[o + 1] = Math.round((y / (h - 1)) * 255);
      data[o + 2] = 128;
      data[o + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
};

describe("color-lab oklab", () => {
  it("round-trips mid grey approximately", () => {
    const [L, a, b] = srgbToOklab(128, 128, 128);
    const rgb = oklabToSrgb(L, a, b);
    expect(Math.abs(rgb[0] - 128)).toBeLessThan(2);
    expect(Math.abs(rgb[1] - 128)).toBeLessThan(2);
    expect(Math.abs(rgb[2] - 128)).toBeLessThan(2);
  });
});

describe("color-lab experiments", () => {
  const src = makeGradient();

  it("rgb bitplane yields at most 8 colours", () => {
    const result = processRgbBitplane(src, {
      noiseStrength: 0.5,
      threshold: 0.5,
      noiseKind: "white",
      frequency: 1,
      correlation: "independent",
      preserveBw: false,
      sharedSeed: false,
    });
    expect(result.uniqueCount).toBeLessThanOrEqual(8);
    expect(extractPalette(result.rgba).length).toBeLessThanOrEqual(8);
  });

  it("compressed rgb stays within interior levels when not preserving bw", () => {
    const result = processCompressedRgb(src, {
      noiseStrength: 0.4,
      threshold: 0.5,
      noiseKind: "white",
      frequency: 1,
      correlation: "independent",
      compression: 0.4,
      centre: 0.5,
      chromaLimit: 1,
      preserveBw: false,
    });
    expect(result.uniqueCount).toBeLessThanOrEqual(8);
  });

  it("oklab cube reports eight structural states", () => {
    const result = processOklabCube(src, {
      noiseStrength: 0.4,
      noiseKind: "white",
      frequency: 1,
      correlation: "independent",
      lLow: 0.2,
      lHigh: 0.85,
      aAmp: 0.08,
      bAmp: 0.08,
      aCentre: 0,
      bCentre: 0,
      chromaConstraint: 1,
      preserveSourceL: false,
      scaleChromaBySource: false,
      preserveBw: false,
    });
    expect(result.extras?.stateCount).toBe(8);
    expect(result.uniqueCount).toBeLessThanOrEqual(8);
  });

  it("gif indexed respects palette size", () => {
    const result = processGifIndexed(src, {
      paletteSize: 4,
      dither: "nearest",
      noiseStrength: 0.3,
      noiseKind: "white",
      frequency: 1,
    });
    expect(result.uniqueCount).toBeLessThanOrEqual(4);
  });
});
