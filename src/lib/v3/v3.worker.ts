/**
 * V3 Web Worker: per-layer palette dither composite.
 */
import { compositeLayers } from "./composite";
import type { V3WorkerRequest, V3WorkerResponse } from "./worker-types";

type WorkerScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<V3WorkerRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

const postResponse = (
  response: V3WorkerResponse,
  transfer?: Transferable[],
): void => {
  const list = transfer ?? [];
  if (list.length > 0) {
    workerScope.postMessage(response, list);
  } else {
    workerScope.postMessage(response);
  }
};

workerScope.onmessage = (e: MessageEvent<V3WorkerRequest>): void => {
  const msg = e.data;
  if (msg.type !== "composite") return;

  const { width, height, id } = msg;
  if (width <= 0 || height <= 0) return;
  if (msg.buffer.byteLength !== width * height * 4) return;
  if (msg.labelsBuffer.byteLength !== width * height) return;

  const source = new ImageData(
    new Uint8ClampedArray(msg.buffer) as Uint8ClampedArray<ArrayBuffer>,
    width,
    height,
  );
  const labels = new Uint8Array(msg.labelsBuffer);
  const result = compositeLayers(source, labels, msg.layerParams);
  const buffer = result.data.buffer.slice(
    result.data.byteOffset,
    result.data.byteOffset + result.data.byteLength,
  );

  postResponse(
    {
      type: "composite-result",
      id,
      buffer,
      width: result.width,
      height: result.height,
    },
    [buffer],
  );
};
