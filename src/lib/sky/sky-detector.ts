/**
 * Native-resolution SegFormer sky detection via onnxruntime-web (WebGPU → WASM).
 * DOM-free — works in workers. Lab/DOM helpers live in src/lib/lab/sky-detector.ts.
 */
import * as ort from "onnxruntime-web/webgpu";
import { ADE20K_SKY_CLASS_ID, classIdToRgb } from "./ade20k-labels";

export const DEFAULT_MODEL_URL = "/models/segformer-b0-ade.onnx";
/** Serve ORT wasm from the npm CDN so we don't commit ~32MB into public/. */
export const DEFAULT_ORT_WASM_PATHS =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

/** Cap long edge so WebGPU memory stays sane under ~2K. */
export const DEFAULT_MAX_LONG_EDGE = 1456;

export type SkyDetectDevice = "webgpu" | "wasm";

export type SkyDetectInput = {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
};

export type SkyDetectResult = {
  width: number;
  height: number;
  /** Inference tensor size (may be downscaled from source). */
  inferWidth: number;
  inferHeight: number;
  /** Logit map size (SegFormer ~1/4 of infer size). */
  logitWidth: number;
  logitHeight: number;
  /** Binary sky mask at source resolution (255 = sky). Hard argmax by default. */
  skyMask: Uint8ClampedArray;
  /** Per-pixel ADE20K class id at source resolution. */
  classMap: Uint16Array;
  /**
   * sky_logit − best_other_logit at source resolution.
   * ≥ 0 ⇒ sky wins argmax; lower refine thresholds pull near-misses in.
   */
  skyMargin: Float32Array;
  /** Colored segmentation preview (RGBA) at source resolution. */
  colorSegRgba: Uint8ClampedArray;
  inferenceMs: number;
  device: SkyDetectDevice;
};

const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

const formatOrtError = (err: unknown): string => {
  if (err instanceof Error) {
    const extra = Object.entries(err)
      .filter(([k]) => k !== "message" && k !== "name" && k !== "stack")
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    return extra ? `${err.message} (${extra})` : err.message;
  }
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
};

export class SkyDetector {
  private session: ort.InferenceSession | null = null;
  private device: SkyDetectDevice = "wasm";
  private initPromise: Promise<void> | null = null;
  private webGpuError: string | null = null;

  get isReady(): boolean {
    return this.session !== null;
  }

  get activeDevice(): SkyDetectDevice {
    return this.device;
  }

  get lastWebGpuError(): string | null {
    return this.webGpuError;
  }

  async initialize(
    modelUrl: string = DEFAULT_MODEL_URL,
    options?: { preferWebGpu?: boolean },
  ): Promise<SkyDetectDevice> {
    if (this.session) return this.device;
    if (this.initPromise) {
      await this.initPromise;
      return this.device;
    }

    this.initPromise = this.createSession(modelUrl, options?.preferWebGpu !== false);
    try {
      await this.initPromise;
      return this.device;
    } finally {
      this.initPromise = null;
    }
  }

  private async createSession(
    modelUrl: string,
    preferWebGpu: boolean,
  ): Promise<void> {
    // Default ORT logLevel is "warning"; WebGPU always emits benign
    // VerifyEachNodeIsAssignedToAnEp notices (shape ops stay on CPU) via
    // console.error, which Next.js treats as runtime errors.
    ort.env.logLevel = "error";
    ort.env.wasm.wasmPaths = DEFAULT_ORT_WASM_PATHS;
    ort.env.wasm.numThreads = 1;

    const providers: SkyDetectDevice[] = preferWebGpu
      ? ["webgpu", "wasm"]
      : ["wasm"];

    let lastError: unknown = null;
    for (const ep of providers) {
      try {
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: [ep],
          // 0=VERBOSE … 2=WARNING … 3=ERROR — hide expected EP-assignment warnings
          logSeverityLevel: 3,
        });
        this.device = ep;
        return;
      } catch (err) {
        lastError = err;
        this.session = null;
        if (ep === "webgpu") {
          this.webGpuError = formatOrtError(err);
          console.warn("[SkyDetector] WebGPU init failed, trying WASM:", err);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to init SkyDetector: ${String(lastError)}`);
  }

  async generateSkyMask(
    input: SkyDetectInput,
    options?: { maxLongEdge?: number },
  ): Promise<SkyDetectResult> {
    if (!this.session) await this.initialize();
    const session = this.session;
    if (!session) throw new Error("SkyDetector session missing");

    const { rgba: srcRgba, width: srcWidth, height: srcHeight } = input;
    if (srcWidth <= 0 || srcHeight <= 0) {
      throw new Error("Image has invalid dimensions");
    }
    if (srcRgba.length !== srcWidth * srcHeight * 4) {
      throw new Error("RGBA buffer size mismatch");
    }

    const maxLongEdge = options?.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
    const { width: inferWidth, height: inferHeight, rgba } = maybeDownscaleRgba(
      srcRgba,
      srcWidth,
      srcHeight,
      maxLongEdge,
    );

    const floatData = prepareNchwFloat32(rgba, inferWidth, inferHeight);
    const inputName = session.inputNames[0] ?? "pixel_values";
    const outputName = session.outputNames[0] ?? "logits";
    const inputTensor = new ort.Tensor("float32", floatData, [
      1,
      3,
      inferHeight,
      inferWidth,
    ]);

    const t0 = performance.now();
    const results = await session.run({ [inputName]: inputTensor });
    const inferenceMs = performance.now() - t0;

    const outputTensor = results[outputName];
    if (!outputTensor) {
      throw new Error(`Missing output tensor "${outputName}"`);
    }

    const dims = outputTensor.dims;
    if (dims.length !== 4) {
      throw new Error(`Unexpected logits rank ${dims.length}`);
    }
    const classes = Number(dims[1]);
    const logitHeight = Number(dims[2]);
    const logitWidth = Number(dims[3]);
    const logits = outputTensor.data as Float32Array;

    const { classMap: lowResClasses, skyMargin: lowResMargin } = argmaxClasses(
      logits,
      classes,
      logitWidth,
      logitHeight,
    );

    const classMap = upsampleNearestU16(
      lowResClasses,
      logitWidth,
      logitHeight,
      srcWidth,
      srcHeight,
    );
    const skyMargin = upsampleNearestF32(
      lowResMargin,
      logitWidth,
      logitHeight,
      srcWidth,
      srcHeight,
    );

    const skyMask = skyMaskFromMargin(skyMargin, 0);
    const colorSegRgba = new Uint8ClampedArray(srcWidth * srcHeight * 4);
    for (let i = 0; i < classMap.length; i++) {
      const cls = classMap[i];
      const [r, g, b] = classIdToRgb(cls);
      const o = i * 4;
      colorSegRgba[o] = r;
      colorSegRgba[o + 1] = g;
      colorSegRgba[o + 2] = b;
      colorSegRgba[o + 3] = 255;
    }

    return {
      width: srcWidth,
      height: srcHeight,
      inferWidth,
      inferHeight,
      logitWidth,
      logitHeight,
      skyMask,
      classMap,
      skyMargin,
      colorSegRgba,
      inferenceMs,
      device: this.device,
    };
  }
}

/** Nearest-neighbour downscale when long edge exceeds maxLongEdge (DOM-free). */
export const maybeDownscaleRgba = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number; rgba: Uint8ClampedArray } => {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height, rgba };
  }

  const scale = maxLongEdge / longEdge;
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(height - 1, Math.floor((y * height) / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / tw));
      const si = (sy * width + sx) * 4;
      const di = (y * tw + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = 255;
    }
  }
  return { width: tw, height: th, rgba: out };
};

const prepareNchwFloat32 = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array => {
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const r = rgba[i * 4] / 255;
    const g = rgba[i * 4 + 1] / 255;
    const b = rgba[i * 4 + 2] / 255;
    out[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    out[i + plane] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    out[i + 2 * plane] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  return out;
};

const argmaxClasses = (
  logits: Float32Array,
  classes: number,
  width: number,
  height: number,
  skyClassId: number = ADE20K_SKY_CLASS_ID,
): { classMap: Uint16Array; skyMargin: Float32Array } => {
  const pixels = width * height;
  const classMap = new Uint16Array(pixels);
  const skyMargin = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    let best = -Infinity;
    let bestC = 0;
    let bestOther = -Infinity;
    const skyLogit = logits[skyClassId * pixels + i];
    for (let c = 0; c < classes; c++) {
      const v = logits[c * pixels + i];
      if (v > best) {
        best = v;
        bestC = c;
      }
      if (c !== skyClassId && v > bestOther) {
        bestOther = v;
      }
    }
    classMap[i] = bestC;
    skyMargin[i] = skyLogit - bestOther;
  }
  return { classMap, skyMargin };
};

const upsampleNearestU16 = (
  src: Uint16Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint16Array => {
  if (sw === dw && sh === dh) return src;
  const out = new Uint16Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      out[y * dw + x] = src[sy * sw + sx];
    }
  }
  return out;
};

const upsampleNearestF32 = (
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Float32Array => {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      out[y * dw + x] = src[sy * sw + sx];
    }
  }
  return out;
};

/** Hard argmax-equivalent: sky wins when skyMargin >= 0. Lower threshold includes near-misses. */
export const skyMaskFromMargin = (
  skyMargin: Float32Array,
  threshold = 0,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(skyMargin.length);
  for (let i = 0; i < skyMargin.length; i++) {
    out[i] = skyMargin[i] >= threshold ? 255 : 0;
  }
  return out;
};

const lumaAt = (rgba: Uint8ClampedArray, i: number): number => {
  const o = i * 4;
  return 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
};

/**
 * Flood-fill sky into neighbouring pixels that look like sky continuation:
 * bright enough (clouds / glow) OR near-miss sky logits (margin corridor).
 * Fills whole connected blobs that touch the hard sky mask.
 */
export const floodSkyIntoBright = (
  skyMask: Uint8ClampedArray,
  sourceRgba: Uint8ClampedArray,
  skyMargin: Float32Array,
  width: number,
  height: number,
  lumaMin: number,
  marginMin: number,
): Uint8ClampedArray => {
  if (lumaMin >= 255 && marginMin >= 100) return skyMask;

  const out = new Uint8ClampedArray(skyMask);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < out.length; i++) {
    if (out[i] > 127) queue[tail++] = i;
  }

  const canClaim = (ni: number): boolean => {
    if (lumaAt(sourceRgba, ni) >= lumaMin) return true;
    if (skyMargin[ni] >= marginMin) return true;
    return false;
  };

  const tryVisit = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const ni = ny * width + nx;
    if (out[ni] > 127) return;
    if (!canClaim(ni)) return;
    out[ni] = 255;
    queue[tail++] = ni;
  };

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    // 8-connected so thin diagonal bridges still fill.
    tryVisit(x - 1, y);
    tryVisit(x + 1, y);
    tryVisit(x, y - 1);
    tryVisit(x, y + 1);
    tryVisit(x - 1, y - 1);
    tryVisit(x + 1, y - 1);
    tryVisit(x - 1, y + 1);
    tryVisit(x + 1, y + 1);
  }
  return out;
};

export type SkyRefineParams = {
  /** 0 = hard argmax; 100 = pull in weak sky near-misses. */
  includeMore: number;
  /** 0 = off; 100 = fill bright / near-miss blobs connected to sky. */
  brightFill: number;
};

export const DEFAULT_SKY_REFINE: SkyRefineParams = {
  includeMore: 0,
  brightFill: 0,
};

/** Map UI includeMore (0–100) → margin threshold (0 → −10). */
export const includeMoreToThreshold = (includeMore: number): number => {
  const t = Math.max(0, Math.min(100, includeMore)) / 100;
  return -10 * t;
};

/** Map UI brightFill (0–100) → luma + margin gates for flood fill. */
export const brightFillToGates = (
  brightFill: number,
): { lumaMin: number; marginMin: number } => {
  const t = Math.max(0, Math.min(100, brightFill)) / 100;
  if (t <= 0) return { lumaMin: 256, marginMin: 100 };
  // Gentle → only very bright; aggressive → dimmer orange haze + weak sky logits.
  const lumaMin = Math.round(220 - t * 170); // 220 → 50
  const marginMin = 2 - t * 10; // 2 → −8 (near-miss corridor)
  return { lumaMin, marginMin };
};

export const refineSkyMask = (
  skyMargin: Float32Array,
  sourceRgba: Uint8ClampedArray,
  width: number,
  height: number,
  params: SkyRefineParams,
): Uint8ClampedArray => {
  const threshold = includeMoreToThreshold(params.includeMore);
  let mask = skyMaskFromMargin(skyMargin, threshold);
  const { lumaMin, marginMin } = brightFillToGates(params.brightFill);
  if (lumaMin < 255 || marginMin < 100) {
    mask = floodSkyIntoBright(
      mask,
      sourceRgba,
      skyMargin,
      width,
      height,
      lumaMin,
      marginMin,
    );
  }
  return mask;
};
