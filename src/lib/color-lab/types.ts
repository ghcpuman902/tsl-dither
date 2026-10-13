/** Shared types for the Color Lab research instrument. */

export type Rgb = readonly [number, number, number];

export type Oklab = readonly [number, number, number];

export type SourceKind =
  | "portrait"
  | "landscape"
  | "gradient"
  | "greyscale"
  | "hue-luma"
  | "dark-detail"
  | "upload";

export type SourceSpec = {
  id: string;
  kind: SourceKind;
  label: string;
  /** Built-in URL, or null for synthetic / upload. */
  src: string | null;
};

export type CropRect = {
  /** Centre of crop in normalised image coords 0–1. */
  cx: number;
  cy: number;
  /** Half-width of crop as fraction of min(w,h). */
  half: number;
};

export type NoiseKind =
  | "white"
  | "blue-approx"
  | "ordered"
  | "scaled"
  | "blurred";

export type ChannelCorrelation = "independent" | "partial" | "shared";

export type ExperimentId =
  | "rgb-bitplane"
  | "compressed-rgb"
  | "oklab-cube"
  | "luma-chroma"
  | "structured-palette"
  | "gif-indexed"
  | "palette-mixture"
  | "noise-placement"
  | "noise-frequency";

export type ExperimentMeta = {
  id: ExperimentId;
  name: string;
  short: string;
  /** One-line change description shown under the canvas. */
  blurb: string;
  /** Included in the coherent first version. */
  implemented: boolean;
};

export type PaletteStats = {
  colors: Rgb[];
  uniqueCount: number;
  averageChroma: number;
  luminanceError: number;
  perceptualError: number;
};

export type ProcessResult = {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  palette: Rgb[];
  uniqueCount: number;
  /** Optional soft reconstruction (local average). */
  reconstruction?: Uint8ClampedArray;
  extras?: Record<string, unknown>;
};

export type SharedLabState = {
  sourceId: string;
  workingLongEdge: number;
  crop: CropRect;
  pinnedIds: ExperimentId[];
};

export const DEFAULT_CROP: CropRect = { cx: 0.5, cy: 0.5, half: 0.12 };

export const WORKING_LONG_EDGE = 384;
export const MAGNIFIER_SIZE = 12;
