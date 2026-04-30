/**
 * Web Worker: CPU-intensive image processing (dither, histogram, tone).
 * Message protocol: see worker-types.ts. Results use transferable ArrayBuffers where possible.
 */
import { applyDither } from "./dither-processor";
import { applyTone, computeHistogram } from "./tone-processor";
import { SRGB_TO_LINEAR_LUT, linear01ToSrgbByte } from "./color-space";
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

  const src = source.data;
  const out = new Uint8ClampedArray(width * height * 4);
  const xScale = source.width / width;
  const yScale = source.height / height;
  const useNearest = params.algorithm === "nearest";

  for (let y = 0; y < height; y++) {
    const sy = (y + 0.5) * yScale - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(source.height - 1, y0 + 1);
    const ty = sy - y0;

    for (let x = 0; x < width; x++) {
      const sx = (x + 0.5) * xScale - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(source.width - 1, x0 + 1);
      const tx = sx - x0;

      const outIdx = (y * width + x) * 4;

      if (useNearest) {
        const nx = Math.max(0, Math.min(source.width - 1, Math.round(sx)));
        const ny = Math.max(0, Math.min(source.height - 1, Math.round(sy)));
        const srcIdx = (ny * source.width + nx) * 4;
        out[outIdx] = src[srcIdx];
        out[outIdx + 1] = src[srcIdx + 1];
        out[outIdx + 2] = src[srcIdx + 2];
        out[outIdx + 3] = src[srcIdx + 3];
        continue;
      }

      const i00 = (y0 * source.width + x0) * 4;
      const i10 = (y0 * source.width + x1) * 4;
      const i01 = (y1 * source.width + x0) * 4;
      const i11 = (y1 * source.width + x1) * 4;

      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;

      const rLin =
        SRGB_TO_LINEAR_LUT[src[i00]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11]] * w11;
      const gLin =
        SRGB_TO_LINEAR_LUT[src[i00 + 1]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10 + 1]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01 + 1]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11 + 1]] * w11;
      const bLin =
        SRGB_TO_LINEAR_LUT[src[i00 + 2]] * w00 +
        SRGB_TO_LINEAR_LUT[src[i10 + 2]] * w10 +
        SRGB_TO_LINEAR_LUT[src[i01 + 2]] * w01 +
        SRGB_TO_LINEAR_LUT[src[i11 + 2]] * w11;
      const alpha =
        src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;

      out[outIdx] = linear01ToSrgbByte(rLin);
      out[outIdx + 1] = linear01ToSrgbByte(gLin);
      out[outIdx + 2] = linear01ToSrgbByte(bLin);
      out[outIdx + 3] = Math.round(alpha);
    }
  }

  return new ImageData(out, width, height);
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
      const result = applyTone(imageData, msg.params, msg.visible, true);
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
