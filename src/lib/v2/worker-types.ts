import type { DitherParams } from "@/lib/types";
import type { V2LayerId } from "./layers";

export type V2WorkerRequest = {
  type: "composite";
  id: number;
  buffer: ArrayBuffer;
  labelsBuffer: ArrayBuffer;
  width: number;
  height: number;
  layerParams: Record<V2LayerId, DitherParams>;
};

export type V2WorkerResponse = {
  type: "composite-result";
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

export type V2CompositeResult = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};
