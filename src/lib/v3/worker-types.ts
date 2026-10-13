import type { PaletteDitherParams } from "./types";
import type { V3LayerId } from "./layers";

export type V3WorkerRequest = {
  type: "composite";
  id: number;
  buffer: ArrayBuffer;
  labelsBuffer: ArrayBuffer;
  width: number;
  height: number;
  layerParams: Record<V3LayerId, PaletteDitherParams>;
};

export type V3WorkerResponse = {
  type: "composite-result";
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

export type V3CompositeResult = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};
