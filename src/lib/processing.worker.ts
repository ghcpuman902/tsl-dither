/**
 * Web Worker: CPU-intensive image processing (dither, histogram, tone).
 * Message protocol: see worker-types.ts. Results use transferable ArrayBuffers where possible.
 */
import { applyDither } from "./dither-processor";
import { applyTone, computeHistogram } from "./tone-processor";
import type { DownsizeParams } from "./types";
import type { WorkerRequest, WorkerResponse } from "./worker-types";

let cachedSource: Uint8ClampedArray | null = null;
let cachedWidth = 0;
let cachedHeight = 0;

type WorkerScope = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

const postResponse = (response: WorkerResponse, transfer?: Transferable[]): void => {
  const list = transfer ?? [];
  if (list.length > 0) {
    workerScope.postMessage(response, list);
  } else {
    workerScope.postMessage(response);
  }
};

/** Build RGBA buffer where R=G=B=channel value (grayscale from one channel). */
const channelToGrayscaleRgba = (
  rgbData: Uint8ClampedArray,
  channelOffset: number,
  width: number,
  height: number
): ArrayBuffer => {
  const len = width * height * 4;
  const out = new Uint8ClampedArray(len);
  for (let i = 0; i < width * height; i++) {
    const v = rgbData[i * 4 + channelOffset];
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = rgbData[i * 4 + 3];
  }
  return out.buffer;
};

const clampDimension = (value: number, max: number): number => {
  const bounded = Math.max(1, Math.min(max, Math.round(value)));
  return Number.isFinite(bounded) ? bounded : 1;
};

const getDownsizeDimensions = (
  srcWidth: number,
  srcHeight: number,
  params: DownsizeParams
): { width: number; height: number } => {
  if (params.mode === "target-width") {
    const width = clampDimension(params.targetWidthPx, srcWidth);
    const ratio = srcHeight / srcWidth;
    const height = clampDimension(width * ratio, srcHeight);
    return { width, height };
  }

  const divisor = params.ratioDivisor;
  const width = clampDimension(srcWidth / divisor, srcWidth);
  const height = clampDimension(srcHeight / divisor, srcHeight);
  return { width, height };
};

const downsizeWithAlgorithm = (
  source: ImageData,
  params: DownsizeParams
): ImageData => {
  const { width, height } = getDownsizeDimensions(source.width, source.height, params);
  if (width === source.width && height === source.height) {
    return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  }

  const srcCanvas = new OffscreenCanvas(source.width, source.height);
  const srcCtx = srcCanvas.getContext("2d", { alpha: false });
  if (!srcCtx) return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  srcCtx.putImageData(source, 0, 0);

  const outCanvas = new OffscreenCanvas(width, height);
  const outCtx = outCanvas.getContext("2d", { alpha: false });
  if (!outCtx) return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);

  const qualityByAlgorithm: Record<DownsizeParams["algorithm"], ImageSmoothingQuality> = {
    nearest: "low",
    bilinear: "low",
    bicubic: "medium",
    lanczos: "high",
  };

  outCtx.imageSmoothingEnabled = params.algorithm !== "nearest";
  outCtx.imageSmoothingQuality = qualityByAlgorithm[params.algorithm];
  outCtx.drawImage(srcCanvas, 0, 0, source.width, source.height, 0, 0, width, height);
  return outCtx.getImageData(0, 0, width, height);
};

workerScope.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const msg = e.data;

  switch (msg.type) {
    case "set-source": {
      cachedSource = new Uint8ClampedArray(msg.buffer);
      cachedWidth = msg.width;
      cachedHeight = msg.height;
      break;
    }

    case "dither": {
      if (!cachedSource || cachedWidth === 0 || cachedHeight === 0) break;
      const sourceImage = new ImageData(
        cachedSource as Uint8ClampedArray<ArrayBuffer>,
        cachedWidth,
        cachedHeight
      );
      const dithered = applyDither(sourceImage, msg.params);
      const d = dithered.data;
      const w = dithered.width;
      const h = dithered.height;

      const rgbBuffer = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
      const rBuffer = channelToGrayscaleRgba(d, 0, w, h);
      const gBuffer = channelToGrayscaleRgba(d, 1, w, h);
      const bBuffer = channelToGrayscaleRgba(d, 2, w, h);

      postResponse(
        {
          type: "dither-result",
          id: msg.id,
          rgbBuffer,
          rBuffer,
          gBuffer,
          bBuffer,
          width: w,
          height: h,
        },
        [rgbBuffer, rBuffer, gBuffer, bBuffer]
      );
      break;
    }

    case "downsize": {
      const { width, height } = msg;
      if (width <= 0 || height <= 0 || msg.buffer.byteLength !== width * height * 4) {
        break;
      }
      const imageData = new ImageData(
        new Uint8ClampedArray(msg.buffer) as Uint8ClampedArray<ArrayBuffer>,
        width,
        height
      );
      const resized = downsizeWithAlgorithm(imageData, msg.params);
      const buffer = resized.data.buffer.slice(
        resized.data.byteOffset,
        resized.data.byteOffset + resized.data.byteLength
      );
      postResponse(
        {
          type: "downsize-result",
          id: msg.id,
          buffer,
          width: resized.width,
          height: resized.height,
        },
        [buffer]
      );
      break;
    }

    case "histogram": {
      const { width, height } = msg;
      if (width <= 0 || height <= 0 || msg.buffer.byteLength !== width * height * 4) {
        break;
      }
      const imageData = new ImageData(
        new Uint8ClampedArray(msg.buffer) as Uint8ClampedArray<ArrayBuffer>,
        width,
        height
      );
      const { r, g, b } = computeHistogram(imageData);
      postResponse({
        type: "histogram-result",
        id: msg.id,
        r,
        g,
        b,
      });
      break;
    }

    case "tone": {
      const imageData = new ImageData(
        new Uint8ClampedArray(msg.buffer) as Uint8ClampedArray<ArrayBuffer>,
        msg.width,
        msg.height
      );
      const result = applyTone(imageData, msg.params, msg.visible);
      const buffer = result.data.buffer.slice(
        result.data.byteOffset,
        result.data.byteOffset + result.data.byteLength
      );
      postResponse(
        {
          type: "tone-result",
          id: msg.id,
          buffer,
          width: result.width,
          height: result.height,
        },
        [buffer]
      );
      break;
    }
  }
};
