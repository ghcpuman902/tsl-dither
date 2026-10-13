import {
  DEFAULT_PALETTE_DITHER_PARAMS,
  type PaletteDitherParams,
} from "./types";
import { PALETTE_BY_ID } from "./palette";

/** Hard pixel labels for the V3 compositor. Every pixel is exactly one. */
export type V3LayerId = "bg" | "fg";

export const V3_LAYER_IDS: readonly V3LayerId[] = ["bg", "fg"] as const;

export const LAYER_BG = 0;
export const LAYER_FG = 1;

export const LAYER_ID_BY_BYTE: readonly V3LayerId[] = ["bg", "fg"];

export const LAYER_BYTE_BY_ID: Record<V3LayerId, number> = {
  bg: LAYER_BG,
  fg: LAYER_FG,
};

export type V3LayerMeta = {
  id: V3LayerId;
  byte: number;
  label: string;
  description: string;
  color: readonly [number, number, number];
};

export const V3_LAYERS: readonly V3LayerMeta[] = [
  {
    id: "bg",
    byte: LAYER_BG,
    label: "Background",
    description: "Detected sky. Ordered Bayer + palette by default.",
    color: [64, 160, 255],
  },
  {
    id: "fg",
    byte: LAYER_FG,
    label: "Foreground",
    description: "Everything else. Noise + palette by default.",
    color: [220, 60, 160],
  },
];

export const DEFAULT_LAYER_PARAMS: Record<V3LayerId, PaletteDitherParams> = {
  bg: {
    ...DEFAULT_PALETTE_DITHER_PARAMS,
    method: "ordered",
    bayerSize: 8,
    strength: 55,
    bias: 0,
    chroma: 0,
    paletteId: "muted",
    palette: PALETTE_BY_ID.muted.colors,
  },
  fg: {
    ...DEFAULT_PALETTE_DITHER_PARAMS,
    method: "noise",
    bayerSize: 4,
    strength: 50,
    bias: 0,
    chroma: 100,
    paletteId: "rgb8",
    palette: PALETTE_BY_ID.rgb8.colors,
  },
};

export const presentLayers = (labels: Uint8Array): Set<V3LayerId> => {
  const present = new Set<V3LayerId>();
  for (let i = 0; i < labels.length; i++) {
    const id = LAYER_ID_BY_BYTE[labels[i]];
    if (id) present.add(id);
    if (present.size === V3_LAYER_IDS.length) break;
  }
  return present;
};
