export type V2ViewMode = "source" | "mask" | "result";

export type { V2LayerId } from "./layers";
export {
  LAYER_BG,
  LAYER_FG,
  V2_LAYERS,
  V2_LAYER_IDS,
  DEFAULT_LAYER_PARAMS,
} from "./layers";

/** 0 in DialKit = native output resolution (no user downscale). */
export const V2_DEFAULT_OUTPUT_LONG_EDGE = 0;
/** Hard ceiling so a huge upload cannot allocate unbounded canvas memory. */
export const V2_SAFE_MAX_LONG_EDGE = 8192;
/** @deprecated Prefer V2_DEFAULT_OUTPUT_LONG_EDGE / sky DEFAULT_MAX_LONG_EDGE. */
export const V2_MAX_LONG_EDGE = 1280;
export const V2_DEFAULT_IMAGE_SRC = "/samples/saturated-abstract-landscape.png";
export const V2_STORAGE_KEY = "tsl-dither-v2";
export const V2_STORAGE_VERSION = 4;
export const V2_SOURCE_FILENAME_KEY = "tsl-dither-v2-source-filename";

export type V2PersistedState = {
  sourceImageSrc: string;
  view: V2ViewMode;
};

export const DEFAULT_V2_STATE: V2PersistedState = {
  sourceImageSrc: V2_DEFAULT_IMAGE_SRC,
  view: "result",
};

export type V2SampleImage = {
  label: string;
  src: string;
  source: string;
};

export const V2_SAMPLE_IMAGES: V2SampleImage[] = [
  {
    label: "Saturated landscape",
    src: V2_DEFAULT_IMAGE_SRC,
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
