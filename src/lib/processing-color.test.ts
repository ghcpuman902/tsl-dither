import { describe, expect, it } from "vitest";
import {
  SRGB_TO_LINEAR_LUT,
  linear01ToSrgbByte,
  linearLuminance,
  srgbByteToLinear01,
} from "./color-space";
import { applyTone } from "./tone-processor";
import { applyDither } from "./dither-processor";
import type { DitherParams, ToneParams } from "./types";

const createGradient = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.round((x / (width - 1)) * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
};

describe("color-space helpers", () => {
  it("keeps lut conversion close to formula conversion", () => {
    for (let i = 0; i <= 255; i++) {
      expect(Math.abs(SRGB_TO_LINEAR_LUT[i] - srgbByteToLinear01(i))).toBeLessThan(1e-6);
    }
  });

  it("has stable luminance coefficients", () => {
    expect(linearLuminance(1, 1, 1)).toBeCloseTo(1, 6);
    expect(linearLuminance(0, 0, 0)).toBe(0);
  });
});

describe("tone and dither brightness", () => {
  it("keeps neutral exposure near identity", () => {
    const input = createGradient(64, 4);
    const params: ToneParams = {
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      saturation: 0,
      temperature: 0,
    };
    const out = applyTone(input, params);
    const mid = (2 * 64 + 32) * 4;
    expect(Math.abs(out.data[mid] - input.data[mid])).toBeLessThanOrEqual(1);
  });

  it("threshold dithering at 50% tracks linear midpoint", () => {
    const img = createGradient(256, 1);
    const params: DitherParams = { method: "threshold", threshold: 50, density: 0, bayerSize: 4 };
    const out = applyDither(img, params);
    let switchedAt = -1;
    for (let x = 0; x < 256; x++) {
      const v = out.data[x * 4];
      if (v === 255) {
        switchedAt = x;
        break;
      }
    }
    // linear 0.5 maps to ~188 in sRGB.
    expect(switchedAt).toBeGreaterThanOrEqual(186);
    expect(switchedAt).toBeLessThanOrEqual(190);
  });

  it("white-noise dithering remains deterministic", () => {
    const img = createGradient(128, 1);
    const params: DitherParams = { method: "white-noise", threshold: 50, density: 35, bayerSize: 4 };
    const a = applyDither(img, params);
    const b = applyDither(img, params);
    expect(a.data).toEqual(b.data);
  });

  it("linear midpoint re-encodes to expected sRGB", () => {
    expect(linear01ToSrgbByte(0.5)).toBeGreaterThanOrEqual(187);
    expect(linear01ToSrgbByte(0.5)).toBeLessThanOrEqual(188);
  });
});

