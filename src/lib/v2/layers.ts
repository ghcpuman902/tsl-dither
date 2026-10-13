import type { DitherParams } from "@/lib/types";

/** Hard pixel labels for the V2 compositor. Every pixel is exactly one. */
export type V2LayerId = "bg" | "fg";

export const V2_LAYER_IDS: readonly V2LayerId[] = ["bg", "fg"] as const;

export const LAYER_BG = 0;
export const LAYER_FG = 1;

export const LAYER_ID_BY_BYTE: readonly V2LayerId[] = ["bg", "fg"];

export const LAYER_BYTE_BY_ID: Record<V2LayerId, number> = {
  bg: LAYER_BG,
  fg: LAYER_FG,
};

export type V2LayerMeta = {
  id: V2LayerId;
  byte: number;
  label: string;
  description: string;
  /** Overlay tint RGB for the mask view. */
  color: readonly [number, number, number];
};

export const V2_LAYERS: readonly V2LayerMeta[] = [
  {
    id: "bg",
    byte: LAYER_BG,
    label: "Background",
    description: "Detected sky. 8×8 Bayer by default.",
    color: [64, 160, 255],
  },
  {
    id: "fg",
    byte: LAYER_FG,
    label: "Foreground",
    description: "Everything else. Threshold + noise opacity by default.",
    color: [220, 60, 160],
  },
];

export const DEFAULT_LAYER_PARAMS: Record<V2LayerId, DitherParams> = {
  bg: {
    method: "bayer",
    threshold: 40,
    opacity: 50,
    bayerSize: 8,
  },
  fg: {
    method: "threshold",
    threshold: 40,
    opacity: 50,
    bayerSize: 4,
  },
};

export const layerCoverage = (
  labels: Uint8Array,
): Record<V2LayerId, number> => {
  const counts: Record<V2LayerId, number> = { bg: 0, fg: 0 };
  for (let i = 0; i < labels.length; i++) {
    const id = LAYER_ID_BY_BYTE[labels[i]];
    if (id) counts[id]++;
  }
  const total = labels.length || 1;
  return {
    bg: Math.round((counts.bg / total) * 100),
    fg: Math.round((counts.fg / total) * 100),
  };
};

export const presentLayers = (labels: Uint8Array): Set<V2LayerId> => {
  const present = new Set<V2LayerId>();
  for (let i = 0; i < labels.length; i++) {
    const id = LAYER_ID_BY_BYTE[labels[i]];
    if (id) present.add(id);
    if (present.size === V2_LAYER_IDS.length) break;
  }
  return present;
};
