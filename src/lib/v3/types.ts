import {
  DEFAULT_PALETTE_ID,
  PALETTE_BY_ID,
  type PalettePresetId,
  type Rgb,
} from "./palette";

export type PaletteDitherMethod = "ordered" | "noise";

export type PaletteDitherParams = {
  method: PaletteDitherMethod;
  /** Bayer matrix size when method is ordered. */
  bayerSize: number;
  /**
   * 0–100 dither amplitude.
   * 0 = hard nearest-palette snap (old threshold).
   * 100 = full step-sized dither (old noisy look).
   */
  strength: number;
  /** −50…50 level bias before matching (negative → darker entries). */
  bias: number;
  /**
   * 0–100 channel decorrelation.
   * 0 = shared offset (clean ordered patterns).
   * 100 = independent per channel (chromatic sparkle).
   */
  chroma: number;
  palette: readonly Rgb[];
  /** Preset id when using a built-in palette (for dials / persist). */
  paletteId: PalettePresetId;
};

export const DEFAULT_PALETTE_DITHER_PARAMS: PaletteDitherParams = {
  method: "noise",
  bayerSize: 4,
  strength: 50,
  bias: 0,
  chroma: 100,
  palette: PALETTE_BY_ID[DEFAULT_PALETTE_ID].colors,
  paletteId: DEFAULT_PALETTE_ID,
};

export type V3ViewMode = "source" | "mask" | "result";

/** 0 in DialKit = native output resolution. */
export const V3_DEFAULT_OUTPUT_LONG_EDGE = 0;
export const V3_SAFE_MAX_LONG_EDGE = 8192;
export const V3_DEFAULT_IMAGE_SRC = "/samples/saturated-abstract-landscape.png";
export const V3_STORAGE_KEY = "tsl-dither-v3";
export const V3_STORAGE_VERSION = 1;
export const V3_SOURCE_FILENAME_KEY = "tsl-dither-v3-source-filename";

export type V3PersistedState = {
  sourceImageSrc: string;
  view: V3ViewMode;
};

export const DEFAULT_V3_STATE: V3PersistedState = {
  sourceImageSrc: V3_DEFAULT_IMAGE_SRC,
  view: "result",
};

export type V3SampleImage = {
  label: string;
  src: string;
  source: string;
};

export const V3_SAMPLE_IMAGES: V3SampleImage[] = [
  {
    label: "Saturated landscape",
    src: V3_DEFAULT_IMAGE_SRC,
    source: "Local sample",
  },
  {
    label: "Default photo",
    src: "/DSC04192_LowRes.jpg",
    source: "Local sample",
  },
  {
    label: "Statue of Liberty",
    src: "/samples/statue-of-liberty.jpg",
    source: "Wikimedia Commons, public domain",
  },
  {
    label: "Colosseum",
    src: "/samples/colosseum.jpg",
    source: "Wikimedia Commons, public domain",
  },
  {
    label: "Eiffel Tower",
    src: "/samples/eiffel-tower.jpg",
    source: "Wikimedia Commons, public domain",
  },
];
