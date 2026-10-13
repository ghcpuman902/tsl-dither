import type { ExperimentId, ExperimentMeta } from "./types";

export const EXPERIMENT_META: readonly ExperimentMeta[] = [
  {
    id: "rgb-bitplane",
    name: "RGB bit-plane",
    short: "Baseline",
    blurb:
      "Independent R/G/B thresholds with per-channel noise → eight cube corners.",
    implemented: true,
  },
  {
    id: "compressed-rgb",
    name: "Compressed RGB cube",
    short: "Muted cube",
    blurb:
      "Same three-bit mechanism; channels quantise to interior low/high instead of 0/255.",
    implemented: true,
  },
  {
    id: "oklab-cube",
    name: "OKLab binary cube",
    short: "OKLab 8",
    blurb:
      "Quantise L, a, b independently to two states each — still eight RGB colours after conversion.",
    implemented: true,
  },
  {
    id: "luma-chroma",
    name: "Preserve luminance, dither chroma",
    short: "L∥C",
    blurb: "Keep L; vary only opponent colour axes.",
    implemented: false,
  },
  {
    id: "structured-palette",
    name: "Structured palette anchors",
    short: "Anchors",
    blurb: "Generate eight colours from black/white + chromatic anchors.",
    implemented: false,
  },
  {
    id: "gif-indexed",
    name: "GIF-style indexed palette",
    short: "Indexed",
    blurb:
      "Median-cut palette from the image, then nearest / ordered / noise / error diffusion.",
    implemented: true,
  },
  {
    id: "palette-mixture",
    name: "Palette mixture dithering",
    short: "Mixture",
    blurb:
      "Weights over nearby palette colours; noise selects one so local averages recover the source.",
    implemented: true,
  },
  {
    id: "noise-placement",
    name: "Noise placement",
    short: "Where?",
    blurb: "Compare noise before, in, during, or after quantisation.",
    implemented: false,
  },
  {
    id: "noise-frequency",
    name: "Spatial frequency & correlation",
    short: "Frequency",
    blurb:
      "Fine luma grain with calmer chromatic noise — or fully independent channel sparkle.",
    implemented: true,
  },
];

export const IMPLEMENTED_IDS: ExperimentId[] = EXPERIMENT_META.filter(
  (e) => e.implemented,
).map((e) => e.id);

export const metaById = (id: ExperimentId): ExperimentMeta =>
  EXPERIMENT_META.find((e) => e.id === id)!;
