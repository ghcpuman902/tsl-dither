/**
 * V2 sky detection worker: SegFormer-B0 ADE20K via onnxruntime-web.
 * Runs off the main thread. Device prefers WebGPU, falls back to WASM.
 */
import {
  DEFAULT_MAX_LONG_EDGE,
  SkyDetector,
  type SkyDetectDevice,
} from "@/lib/sky/sky-detector";

type WorkerScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<SkyWorkerRequest>) => void) | null;
};

export type SkyWorkerRequest =
  | { type: "warmup" }
  | {
      type: "detect";
      id: number;
      buffer: ArrayBuffer;
      width: number;
      height: number;
      maxLongEdge?: number;
    };

export type SkyWorkerResponse =
  | { type: "ready"; device: SkyDetectDevice }
  | {
      type: "detect-result";
      id: number;
      skyMarginBuffer: ArrayBuffer;
      classMapBuffer: ArrayBuffer;
      width: number;
      height: number;
      inferWidth: number;
      inferHeight: number;
      logitWidth: number;
      logitHeight: number;
      inferenceMs: number;
      device: SkyDetectDevice;
    }
  | { type: "error"; id?: number; message: string };

const workerScope = self as unknown as WorkerScope;

const post = (response: SkyWorkerResponse, transfer?: Transferable[]): void => {
  if (transfer && transfer.length > 0) {
    workerScope.postMessage(response, transfer);
  } else {
    workerScope.postMessage(response);
  }
};

const detector = new SkyDetector();

workerScope.onmessage = async (
  e: MessageEvent<SkyWorkerRequest>,
): Promise<void> => {
  const msg = e.data;

  try {
    if (msg.type === "warmup") {
      const device = await detector.initialize();
      post({ type: "ready", device });
      return;
    }

    if (msg.type !== "detect") return;

    const { id, width, height } = msg;
    if (width <= 0 || height <= 0) {
      post({ type: "error", id, message: "Invalid image dimensions" });
      return;
    }
    if (msg.buffer.byteLength !== width * height * 4) {
      post({ type: "error", id, message: "Buffer size mismatch" });
      return;
    }

    if (!detector.isReady) {
      await detector.initialize();
    }

    const maxLongEdge =
      typeof msg.maxLongEdge === "number" && msg.maxLongEdge > 0
        ? msg.maxLongEdge
        : DEFAULT_MAX_LONG_EDGE;

    const rgba = new Uint8ClampedArray(msg.buffer);
    const result = await detector.generateSkyMask(
      { rgba, width, height },
      { maxLongEdge },
    );

    const skyMarginCopy = new Float32Array(result.skyMargin);
    const classMapCopy = new Uint16Array(result.classMap);
    const skyMarginBuffer = skyMarginCopy.buffer;
    const classMapBuffer = classMapCopy.buffer;

    post(
      {
        type: "detect-result",
        id,
        skyMarginBuffer,
        classMapBuffer,
        width: result.width,
        height: result.height,
        inferWidth: result.inferWidth,
        inferHeight: result.inferHeight,
        logitWidth: result.logitWidth,
        logitHeight: result.logitHeight,
        inferenceMs: result.inferenceMs,
        device: result.device,
      },
      [skyMarginBuffer, classMapBuffer],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const id = msg.type === "detect" ? msg.id : undefined;
    post({ type: "error", id, message });
  }
};
