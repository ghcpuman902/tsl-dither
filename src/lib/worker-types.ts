import type { DitherParams, DownsizeParams, ToneParams, ToneVisible } from "./types";

/** Requests sent from main thread to the processing worker. */
export type WorkerRequest =
  | {
      type: "set-source";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | { type: "dither"; id: number; params: DitherParams }
  | {
      type: "downsize";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      params: DownsizeParams;
    }
  | {
      type: "histogram";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      type: "tone";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      params: ToneParams;
      visible: ToneVisible;
    };

/** Responses sent from the processing worker to the main thread. */
export type WorkerResponse =
  | {
      type: "dither-result";
      id: number;
      rgbBuffer: ArrayBuffer;
      rBuffer: ArrayBuffer;
      gBuffer: ArrayBuffer;
      bBuffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      type: "downsize-result";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    }
  | {
      type: "histogram-result";
      id: number;
      r: number[];
      g: number[];
      b: number[];
    }
  | {
      type: "tone-result";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
    };

/** Histogram data shape returned by the worker (for consumers). */
export type HistogramData = { r: number[]; g: number[]; b: number[] };

/** Dither result: full RGB ImageData dimensions + pre-split channel buffers (RGBA, R grayscale, G grayscale, B grayscale). */
export type DitherResult = {
  width: number;
  height: number;
  rgbBuffer: ArrayBuffer;
  rBuffer: ArrayBuffer;
  gBuffer: ArrayBuffer;
  bBuffer: ArrayBuffer;
};
