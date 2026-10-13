import {
  ditherPixelInto,
  preparePaletteRecipe,
  type PreparedPaletteRecipe,
} from "./palette-dither";
import type { PaletteDitherParams } from "./types";
import {
  LAYER_BYTE_BY_ID,
  LAYER_ID_BY_BYTE,
  V3_LAYERS,
  presentLayers,
  type V3LayerId,
} from "./layers";

/**
 * Single-pass composite: pick each pixel's layer recipe and palette-dither in place.
 * Avoids dithering the full image once per layer.
 */
export const compositeLayers = (
  source: ImageData,
  labels: Uint8Array,
  layerParams: Record<V3LayerId, PaletteDitherParams>,
): ImageData => {
  const { width, height, data: src } = source;
  if (labels.length !== width * height) {
    throw new Error("Label size does not match source image");
  }

  const present = presentLayers(labels);
  const recipes = new Map<V3LayerId, PreparedPaletteRecipe>();
  for (const id of present) {
    recipes.set(id, preparePaletteRecipe(layerParams[id]));
  }

  const out = new Uint8ClampedArray(src.length);
  const fgRecipe = recipes.get("fg");

  for (let i = 0; i < labels.length; i++) {
    const layerId = LAYER_ID_BY_BYTE[labels[i]] ?? "fg";
    const recipe = recipes.get(layerId) ?? fgRecipe;
    const o = i * 4;
    if (!recipe) {
      out[o] = src[o];
      out[o + 1] = src[o + 1];
      out[o + 2] = src[o + 2];
      out[o + 3] = 255;
      continue;
    }
    const x = i % width;
    const y = (i / width) | 0;
    ditherPixelInto(
      out,
      o,
      src[o],
      src[o + 1],
      src[o + 2],
      x,
      y,
      i,
      recipe,
    );
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
  for (const layer of V3_LAYERS) {
    colorByByte.set(layer.byte, layer.color);
  }

  for (let i = 0; i < labels.length; i++) {
    const tint = colorByByte.get(labels[i]);
    if (!tint) continue;
    if (labels[i] === LAYER_BYTE_BY_ID.fg) continue;
    const o = i * 4;
    out[o] = Math.round(out[o] * inv + tint[0] * a);
    out[o + 1] = Math.round(out[o + 1] * inv + tint[1] * a);
    out[o + 2] = Math.round(out[o + 2] * inv + tint[2] * a);
  }

  return new ImageData(out, width, height);
};
