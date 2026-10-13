import { LAYER_BG, LAYER_FG } from "./layers";

/** Convert a binary sky mask (255 = sky) into bg/fg layer labels. */
export const labelsFromSkyMask = (skyMask: Uint8ClampedArray): Uint8Array => {
  const labels = new Uint8Array(skyMask.length);
  for (let i = 0; i < skyMask.length; i++) {
    labels[i] = skyMask[i] > 127 ? LAYER_BG : LAYER_FG;
  }
  return labels;
};
