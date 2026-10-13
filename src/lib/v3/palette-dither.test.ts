import { describe, expect, it } from "vitest";
import { clearNearestLutCache, getNearestLut } from "./nearest-lut";
import { applyPaletteDither } from "./palette-dither";
import { PALETTE_BY_ID, PALETTE_RGB8 } from "./palette";
import { compositeLayers } from "./composite";
import { LAYER_BG, LAYER_FG, DEFAULT_LAYER_PARAMS } from "./layers";
import { labelsFromSkyMask } from "./labels";
import type { PaletteDitherParams } from "./types";

const createSolid = (
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return new ImageData(data, width, height);
};

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

const uniqueColors = (img: ImageData): Set<string> => {
  const set = new Set<string>();
  for (let i = 0; i < img.data.length; i += 4) {
    set.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`);
  }
  return set;
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

describe("nearest LUT", () => {
  it("maps pure black and white to themselves for bw palette", () => {
    clearNearestLutCache();
    const lut = getNearestLut(PALETTE_BY_ID.bw.colors);
    // cell 0 ≈ black, cell 63 ≈ white
    expect(lut.lut[0]).toBe(0);
    const whiteIdx =
      (63 * 64 + 63) * 64 + 63;
    expect(lut.lut[whiteIdx]).toBe(1);
    expect(lut.medianStep).toBeGreaterThan(0.5);
  });

  it("caches by signature", () => {
    clearNearestLutCache();
    const a = getNearestLut(PALETTE_RGB8);
    const b = getNearestLut(PALETTE_RGB8);
    expect(a).toBe(b);
  });
});

describe("applyPaletteDither", () => {
  const base: PaletteDitherParams = {
    method: "noise",
    bayerSize: 4,
    strength: 0,
    bias: 0,
    chroma: 0,
    palette: PALETTE_BY_ID.bw.colors,
    paletteId: "bw",
  };

  it("strength 0 snaps near-black to black", () => {
    const img = createSolid(4, 4, 10, 10, 10);
    const out = applyPaletteDither(img, base);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(0);
      expect(out.data[i + 1]).toBe(0);
      expect(out.data[i + 2]).toBe(0);
    }
  });

  it("strength 0 snaps near-white to white", () => {
    const img = createSolid(4, 4, 250, 250, 250);
    const out = applyPaletteDither(img, base);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255);
      expect(out.data[i + 1]).toBe(255);
      expect(out.data[i + 2]).toBe(255);
    }
  });

  it("only emits palette colours", () => {
    const img = createGradient(32, 8);
    const out = applyPaletteDither(img, {
      ...base,
      method: "ordered",
      bayerSize: 8,
      strength: 70,
      palette: PALETTE_BY_ID.gameboy.colors,
      paletteId: "gameboy",
    });
    const allowed = new Set(
      PALETTE_BY_ID.gameboy.colors.map((c) => `${c[0]},${c[1]},${c[2]}`),
    );
    for (const key of uniqueColors(out)) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  it("is deterministic for the same params", () => {
    const img = createGradient(16, 16);
    const params: PaletteDitherParams = {
      ...base,
      method: "noise",
      strength: 60,
      chroma: 100,
      palette: PALETTE_RGB8,
      paletteId: "rgb8",
    };
    const a = applyPaletteDither(img, params);
    const b = applyPaletteDither(img, params);
    expect(a.data).toEqual(b.data);
  });
});

describe("compositeLayers", () => {
  it("uses per-layer recipes and stays in each layer palette", () => {
    const img = createGradient(16, 16);
    const labels = new Uint8Array(16 * 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        labels[y * 16 + x] = x < 8 ? LAYER_BG : LAYER_FG;
      }
    }
    const layerParams = {
      bg: {
        ...DEFAULT_LAYER_PARAMS.bg,
        strength: 40,
        paletteId: "bw" as const,
        palette: PALETTE_BY_ID.bw.colors,
      },
      fg: {
        ...DEFAULT_LAYER_PARAMS.fg,
        strength: 40,
        paletteId: "cga" as const,
        palette: PALETTE_BY_ID.cga.colors,
      },
    };
    const out = compositeLayers(img, labels, layerParams);
    const bw = new Set(
      PALETTE_BY_ID.bw.colors.map((c) => `${c[0]},${c[1]},${c[2]}`),
    );
    const cga = new Set(
      PALETTE_BY_ID.cga.colors.map((c) => `${c[0]},${c[1]},${c[2]}`),
    );
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const o = (y * 16 + x) * 4;
        const key = `${out.data[o]},${out.data[o + 1]},${out.data[o + 2]}`;
        if (x < 8) expect(bw.has(key)).toBe(true);
        else expect(cga.has(key)).toBe(true);
      }
    }
  });
});
