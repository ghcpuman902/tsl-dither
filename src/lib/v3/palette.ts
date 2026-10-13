/** RGB byte triple 0–255. */
export type Rgb = readonly [number, number, number];

export type PalettePresetId =
  | "rgb8"
  | "bw"
  | "cga"
  | "gameboy"
  | "sunset"
  | "muted";

export type PalettePreset = {
  id: PalettePresetId;
  label: string;
  description: string;
  colors: readonly Rgb[];
};

/** Classic 1-bit-per-channel cube corners (matches old binary dither gamut). */
export const PALETTE_RGB8: readonly Rgb[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

export const PALETTE_PRESETS: readonly PalettePreset[] = [
  {
    id: "rgb8",
    label: "RGB 8",
    description: "Cube corners — old binary look",
    colors: PALETTE_RGB8,
  },
  {
    id: "bw",
    label: "Black & white",
    description: "Two-level greyscale",
    colors: [
      [0, 0, 0],
      [255, 255, 255],
    ],
  },
  {
    id: "cga",
    label: "CGA",
    description: "Classic CGA cyan/magenta",
    colors: [
      [0, 0, 0],
      [0, 255, 255],
      [255, 0, 255],
      [255, 255, 255],
    ],
  },
  {
    id: "gameboy",
    label: "Game Boy",
    description: "Four greenish levels",
    colors: [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15],
    ],
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm landscape accents",
    colors: [
      [26, 19, 48],
      [92, 44, 90],
      [196, 78, 82],
      [242, 148, 74],
      [250, 216, 140],
      [255, 255, 255],
    ],
  },
  {
    id: "muted",
    label: "Muted",
    description: "Soft print-like set",
    colors: [
      [40, 42, 48],
      [90, 100, 110],
      [140, 150, 145],
      [180, 160, 130],
      [120, 140, 160],
      [220, 215, 205],
      [250, 248, 240],
    ],
  },
];

export const PALETTE_BY_ID: Record<PalettePresetId, PalettePreset> =
  Object.fromEntries(PALETTE_PRESETS.map((p) => [p.id, p])) as Record<
    PalettePresetId,
    PalettePreset
  >;

export const DEFAULT_PALETTE_ID: PalettePresetId = "rgb8";

export const isPalettePresetId = (value: string): value is PalettePresetId =>
  value in PALETTE_BY_ID;

/** Stable string key for LUT caching. */
export const paletteSignature = (palette: readonly Rgb[]): string => {
  const parts: string[] = [String(palette.length)];
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    parts.push(`${c[0]},${c[1]},${c[2]}`);
  }
  return parts.join("|");
};
