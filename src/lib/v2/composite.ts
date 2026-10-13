import { applyDither } from "@/lib/dither-processor";
import type { DitherParams } from "@/lib/types";
import {
  LAYER_BYTE_BY_ID,
  LAYER_ID_BY_BYTE,
  V2_LAYERS,
  presentLayers,
  type V2LayerId,
} from "./layers";

/**
 * Dither each present layer with its recipe, then hard-composite by label.
 * Bg / fg: source → per-layer dither params (Bayer / threshold+opacity).
 */
export const compositeLayers = (
  source: ImageData,
  labels: Uint8Array,
  layerParams: Record<V2LayerId, DitherParams>,
): ImageData => {
  const { width, height } = source;
  if (labels.length !== width * height) {
    throw new Error("Label size does not match source image");
  }

  const present = presentLayers(labels);
  const dithered = new Map<V2LayerId, Uint8ClampedArray>();

  for (const id of present) {
    dithered.set(id, applyDither(source, layerParams[id]).data);
  }

  const out = new Uint8ClampedArray(source.data.length);
  const fgFallback = dithered.get("fg") ?? source.data;

  for (let i = 0; i < labels.length; i++) {
    const layerId = LAYER_ID_BY_BYTE[labels[i]] ?? "fg";
    const from = dithered.get(layerId) ?? fgFallback;
    const o = i * 4;
    out[o] = from[o];
    out[o + 1] = from[o + 1];
    out[o + 2] = from[o + 2];
    out[o + 3] = 255;
  }

  return new ImageData(out, width, height);
};

/** Multi-colour overlay for the mask view (tints bg only). */
export const buildLayerOverlay = (
  source: ImageData,
  labels: Uint8Array,
  alpha = 0.45,
): ImageData => {
  const { data, width, height } = source;
  const out = new Uint8ClampedArray(data);
  const a = Math.max(0, Math.min(1, alpha));
  const inv = 1 - a;

  const colorByByte = new Map<number, readonly [number, number, number]>();
  for (const layer of V2_LAYERS) {
    colorByByte.set(layer.byte, layer.color);
  }

  for (let i = 0; i < labels.length; i++) {
    const tint = colorByByte.get(labels[i]);
    if (!tint) continue;
    // Leave fg almost un-tinted so detail stays readable.
    if (labels[i] === LAYER_BYTE_BY_ID.fg) continue;
    const o = i * 4;
    out[o] = Math.round(out[o] * inv + tint[0] * a);
    out[o + 1] = Math.round(out[o + 1] * inv + tint[1] * a);
    out[o + 2] = Math.round(out[o + 2] * inv + tint[2] * a);
  }

  return new ImageData(out, width, height);
};
