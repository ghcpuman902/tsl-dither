import { describe, expect, it } from "vitest";
import {
  containLetterbox,
  extractContentDepth,
  normalizeDepth01,
  rgbaToNchw,
} from "./depth-estimator";

describe("containLetterbox", () => {
  it("fits a landscape source into a wider model canvas", () => {
    const box = containLetterbox(1600, 900, 560, 448);
    expect(box.width).toBe(560);
    expect(box.height).toBe(315);
    expect(box.x).toBe(0);
    expect(box.y).toBe(Math.floor((448 - 315) / 2));
  });

  it("fits a portrait source with side bars", () => {
    const box = containLetterbox(900, 1600, 560, 448);
    expect(box.height).toBe(448);
    expect(box.width).toBe(252);
    expect(box.y).toBe(0);
    expect(box.x).toBe(Math.floor((560 - 252) / 2));
  });
});

describe("rgbaToNchw", () => {
  it("writes ImageNet-normalized NCHW floats", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const nchw = rgbaToNchw(rgba, 2, 1, "imagenet");
    expect(nchw.length).toBe(6);
    // R channel pixel 0: (1 - 0.485) / 0.229
    expect(nchw[0]!).toBeCloseTo((1 - 0.485) / 0.229, 5);
    // G channel pixel 1: (1 - 0.456) / 0.224
    expect(nchw[3]!).toBeCloseTo((1 - 0.456) / 0.224, 5);
  });
});

describe("extractContentDepth + normalizeDepth01", () => {
  it("crops the letterbox and normalizes to 0..1", () => {
    const modelWidth = 4;
    const modelHeight = 3;
    const depth = new Float32Array([
      0, 0, 0, 0, // pad row
      0, 10, 20, 0,
      0, 0, 0, 0,
    ]);
    const content = { x: 1, y: 1, width: 2, height: 1 };
    const cropped = extractContentDepth(depth, modelWidth, modelHeight, content);
    expect(Array.from(cropped)).toEqual([10, 20]);
    const normalized = normalizeDepth01(cropped);
    expect(normalized[0]).toBeCloseTo(0);
    expect(normalized[1]).toBeCloseTo(1);
  });
});
