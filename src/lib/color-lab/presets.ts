/**
 * Named philosophy presets that configure multiple experiments at once.
 */

import type { CompressedRgbParams } from "./experiments/compressed-rgb";
import { DEFAULT_COMPRESSED_RGB } from "./experiments/compressed-rgb";
import type { GifIndexedParams } from "./experiments/gif-indexed";
import { DEFAULT_GIF_INDEXED } from "./experiments/gif-indexed";
import type { NoiseFrequencyParams } from "./experiments/noise-frequency";
import { DEFAULT_NOISE_FREQUENCY } from "./experiments/noise-frequency";
import type { OklabCubeParams } from "./experiments/oklab-cube";
import { DEFAULT_OKLAB_CUBE } from "./experiments/oklab-cube";
import type { PaletteMixtureParams } from "./experiments/palette-mixture";
import { DEFAULT_PALETTE_MIXTURE } from "./experiments/palette-mixture";
import type { RgbBitplaneParams } from "./experiments/rgb-bitplane";
import { DEFAULT_RGB_BITPLANE } from "./experiments/rgb-bitplane";

export type LabParamsBundle = {
  rgbBitplane: RgbBitplaneParams;
  compressedRgb: CompressedRgbParams;
  oklabCube: OklabCubeParams;
  gifIndexed: GifIndexedParams;
  paletteMixture: PaletteMixtureParams;
  noiseFrequency: NoiseFrequencyParams;
};

export type PresetId =
  | "raw-rgb"
  | "muted-rgb"
  | "soft-oklab"
  | "dark-green-grain"
  | "warm-cool-film"
  | "gif-eight"
  | "faithful-mixture"
  | "low-freq-chroma";

export type LabPreset = {
  id: PresetId;
  label: string;
  description: string;
  apply: (current: LabParamsBundle) => LabParamsBundle;
};

export const DEFAULT_LAB_PARAMS: LabParamsBundle = {
  rgbBitplane: DEFAULT_RGB_BITPLANE,
  compressedRgb: DEFAULT_COMPRESSED_RGB,
  oklabCube: DEFAULT_OKLAB_CUBE,
  gifIndexed: DEFAULT_GIF_INDEXED,
  paletteMixture: DEFAULT_PALETTE_MIXTURE,
  noiseFrequency: DEFAULT_NOISE_FREQUENCY,
};

export const LAB_PRESETS: readonly LabPreset[] = [
  {
    id: "raw-rgb",
    label: "Raw RGB",
    description: "Saturated three-channel one-bit cube corners.",
    apply: (c) => ({
      ...c,
      rgbBitplane: {
        ...DEFAULT_RGB_BITPLANE,
        noiseStrength: 0.6,
        correlation: "independent",
        preserveBw: false,
      },
      noiseFrequency: {
        ...DEFAULT_NOISE_FREQUENCY,
        splitLumaChroma: false,
        correlation: "independent",
        lumaFrequency: 1,
        chromaFrequency: 1,
      },
    }),
  },
  {
    id: "muted-rgb",
    label: "Muted RGB",
    description: "Compressed cube — extremes pulled inward.",
    apply: (c) => ({
      ...c,
      compressedRgb: {
        ...DEFAULT_COMPRESSED_RGB,
        compression: 0.45,
        chromaLimit: 0.7,
        preserveBw: true,
      },
    }),
  },
  {
    id: "soft-oklab",
    label: "Soft OKLab",
    description: "Narrow a/b with preserved source luminance.",
    apply: (c) => ({
      ...c,
      oklabCube: {
        ...DEFAULT_OKLAB_CUBE,
        aAmp: 0.04,
        bAmp: 0.04,
        preserveSourceL: true,
        scaleChromaBySource: true,
        chromaConstraint: 0.8,
      },
    }),
  },
  {
    id: "dark-green-grain",
    label: "Dark Green Grain",
    description: "Subtle dark-green dots in shadows; shared structure.",
    apply: (c) => ({
      ...c,
      compressedRgb: {
        ...DEFAULT_COMPRESSED_RGB,
        compression: 0.55,
        centre: 0.28,
        chromaLimit: 0.5,
        preserveBw: true,
        correlation: "partial",
      },
      noiseFrequency: {
        ...DEFAULT_NOISE_FREQUENCY,
        splitLumaChroma: true,
        correlation: "partial",
        lumaFrequency: 1,
        chromaFrequency: 0.2,
        noiseStrength: 0.4,
      },
      oklabCube: {
        ...DEFAULT_OKLAB_CUBE,
        aAmp: 0.03,
        bAmp: 0.05,
        bCentre: 0.02,
        aCentre: -0.02,
        preserveSourceL: true,
        scaleChromaBySource: true,
      },
    }),
  },
  {
    id: "warm-cool-film",
    label: "Warm/Cool Film",
    description: "Restrained warm/cool OKLab bias with muted cube.",
    apply: (c) => ({
      ...c,
      oklabCube: {
        ...DEFAULT_OKLAB_CUBE,
        aAmp: 0.05,
        bAmp: 0.06,
        aCentre: 0.01,
        bCentre: 0.02,
        preserveSourceL: true,
        chromaConstraint: 0.7,
      },
      compressedRgb: {
        ...DEFAULT_COMPRESSED_RGB,
        compression: 0.4,
        chromaLimit: 0.6,
      },
    }),
  },
  {
    id: "gif-eight",
    label: "GIF Eight Colours",
    description: "Image-derived 8-colour indexed palette.",
    apply: (c) => ({
      ...c,
      gifIndexed: {
        ...DEFAULT_GIF_INDEXED,
        paletteSize: 8,
        dither: "ordered",
      },
    }),
  },
  {
    id: "faithful-mixture",
    label: "Faithful Palette Mixture",
    description: "Eight-colour palette with deterministic mixture selection.",
    apply: (c) => ({
      ...c,
      paletteMixture: {
        ...DEFAULT_PALETTE_MIXTURE,
        paletteSource: "image-8",
        mode: "four",
        noiseKind: "blue-approx",
        useErrorDiffusion: false,
      },
    }),
  },
  {
    id: "low-freq-chroma",
    label: "Low-Frequency Chroma",
    description: "Fine luminance texture; larger, calmer chromatic regions.",
    apply: (c) => ({
      ...c,
      noiseFrequency: {
        ...DEFAULT_NOISE_FREQUENCY,
        splitLumaChroma: true,
        lumaFrequency: 1,
        chromaFrequency: 0.15,
        correlation: "partial",
        noiseKind: "blurred",
      },
      rgbBitplane: {
        ...DEFAULT_RGB_BITPLANE,
        frequency: 0.35,
        correlation: "partial",
        noiseKind: "scaled",
      },
    }),
  },
];
