import { applyDither } from "../dither-processor";
import type { DitherParams } from "../types";
import {
  refineSkyMask,
  skyMaskFromMargin,
} from "../sky/sky-detector";
import {
  DEFAULT_LAYER_PARAMS,
  LAYER_BG,
  LAYER_FG,
} from "./layers";
import { labelsFromSkyMask } from "./labels";
import { compositeLayers } from "./composite";
import { describe, expect, it } from "vitest";

const createGradient = (width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.round((x / Math.max(1, width - 1)) * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
};

const createSolid = (
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return data;
};

describe("labelsFromSkyMask", () => {
  it("maps sky pixels to bg and the rest to fg", () => {
    const mask = new Uint8ClampedArray([255, 0, 200, 10]);
    const labels = labelsFromSkyMask(mask);
    expect(labels[0]).toBe(LAYER_BG);
    expect(labels[1]).toBe(LAYER_FG);
    expect(labels[2]).toBe(LAYER_BG);
    expect(labels[3]).toBe(LAYER_FG);
  });
});

describe("skyMaskFromMargin / refineSkyMask", () => {
  it("treats non-negative margin as sky at threshold 0", () => {
    const margin = new Float32Array([2, 0, -0.1, -5]);
    const mask = skyMaskFromMargin(margin, 0);
    expect(mask[0]).toBe(255);
    expect(mask[1]).toBe(255);
    expect(mask[2]).toBe(0);
    expect(mask[3]).toBe(0);
  });

  it("includeMore pulls near-misses in", () => {
    const margin = new Float32Array([2, -3, -12]);
    const rgba = createSolid(3, 1, 20, 20, 20);
    const hard = refineSkyMask(margin, rgba, 3, 1, {
      includeMore: 0,
      brightFill: 0,
    });
    expect(hard[0]).toBe(255);
    expect(hard[1]).toBe(0);
    expect(hard[2]).toBe(0);

    const soft = refineSkyMask(margin, rgba, 3, 1, {
      includeMore: 50,
      brightFill: 0,
    });
    // threshold = -5 → margin -3 is included, -12 is not
    expect(soft[0]).toBe(255);
    expect(soft[1]).toBe(255);
    expect(soft[2]).toBe(0);
  });

  it("brightFill floods into bright neighbours connected to sky", () => {
    // 3×3: centre sky, surrounding bright but negative margin
    const w = 3;
    const h = 3;
    const margin = new Float32Array(w * h).fill(-20);
    margin[4] = 5; // centre is hard sky
    const rgba = createSolid(w, h, 240, 200, 80); // bright sunset orange
    const filled = refineSkyMask(margin, rgba, w, h, {
      includeMore: 0,
      brightFill: 80,
    });
    expect(filled[4]).toBe(255);
    // Neighbours should fill because they are bright + connected
    expect(filled[1]).toBe(255);
    expect(filled[3]).toBe(255);
    expect(filled[5]).toBe(255);
    expect(filled[7]).toBe(255);
  });
});

describe("v2 compositeLayers", () => {
  it("takes bg pixels from Bayer and fg from threshold+opacity", () => {
    const img = createGradient(16, 16);
    const labels = new Uint8Array(16 * 16).fill(LAYER_FG);
    for (let y = 0; y < 16; y++) {
      for (let x = 8; x < 16; x++) {
        labels[y * 16 + x] = LAYER_BG;
      }
    }

    const layerParams = {
      ...DEFAULT_LAYER_PARAMS,
      bg: {
        method: "bayer",
        threshold: 40,
        opacity: 50,
        bayerSize: 8,
      } satisfies DitherParams,
      fg: {
        method: "threshold",
        threshold: 40,
        opacity: 50,
        bayerSize: 4,
      } satisfies DitherParams,
    };

    const fgFull = applyDither(img, layerParams.fg);
    const bgFull = applyDither(img, layerParams.bg);
    const out = compositeLayers(img, labels, layerParams);

    const fgIdx = (8 * 16 + 2) * 4;
    const bgIdx = (8 * 16 + 12) * 4;

    expect(out.data[fgIdx]).toBe(fgFull.data[fgIdx]);
    expect(out.data[fgIdx + 1]).toBe(fgFull.data[fgIdx + 1]);
    expect(out.data[fgIdx + 2]).toBe(fgFull.data[fgIdx + 2]);

    expect(out.data[bgIdx]).toBe(bgFull.data[bgIdx]);
    expect(out.data[bgIdx + 1]).toBe(bgFull.data[bgIdx + 1]);
    expect(out.data[bgIdx + 2]).toBe(bgFull.data[bgIdx + 2]);
  });
});
