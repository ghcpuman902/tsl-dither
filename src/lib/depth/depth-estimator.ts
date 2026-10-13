/**
 * One-shot monocular depth via onnxruntime-web (WebGPU → WASM).
 * Default model: Depth Anything V2 Small (quality-oriented, browser-sized).
 * Patterns adapted from https://vgpu.sh/examples/depth-estimation
 */
import * as ort from "onnxruntime-web/webgpu";

export const DEFAULT_ORT_WASM_PATHS =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

export type DepthDevice = "webgpu" | "wasm";

export type DepthNormalization = "imagenet" | "rgb255";

export type DepthModelSpec = {
  id: string;
  label: string;
  url: string;
  width: number;
  height: number;
  inputName: string;
  outputName: string;
  normalization: DepthNormalization;
};

/** Depth Anything V2 Small — ~94.5 MiB, 560×448. A few seconds of inference is OK. */
export const DEPTH_ANYTHING_V2_SMALL: DepthModelSpec = {
  id: "dav2-small",
  label: "Depth Anything V2 small",
  url: "https://vgpu.sh/models/depth/dav2-small.onnx",
  width: 560,
  height: 448,
  inputName: "pixel_values",
  outputName: "predicted_depth",
  normalization: "imagenet",
};

export const DEFAULT_DEPTH_MODEL = DEPTH_ANYTHING_V2_SMALL;

export type DepthEstimateResult = {
  /** Relative depth, row-major, size width×height. Higher ≈ closer. */
  depth: Float32Array;
  width: number;
  height: number;
  /** Content region inside the letterboxed model input (pixel coords). */
  content: { x: number; y: number; width: number; height: number };
  inferenceMs: number;
  loadMs: number;
  device: DepthDevice;
  modelId: string;
};

export type DepthProgress =
  | { phase: "loading-model"; loadedBytes?: number; totalBytes?: number }
  | { phase: "estimating" }
  | { phase: "ready"; inferenceMs: number; device: DepthDevice };

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
  return String(err);
};

export const containLetterbox = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`Invalid source size ${sourceWidth}x${sourceHeight}`);
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    x: Math.floor((targetWidth - width) / 2),
    y: Math.floor((targetHeight - height) / 2),
    width,
    height,
  };
};

export const rgbaToNchw = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  normalization: DepthNormalization,
): Float32Array => {
  const pixels = width * height;
  if (rgba.length < pixels * 4) {
    throw new Error(
      `Expected ${pixels * 4} RGBA bytes for ${width}x${height}, got ${rgba.length}`,
    );
  }
  const output = new Float32Array(pixels * 3);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[pixel * 4 + channel]! / 255;
      output[channel * pixels + pixel] =
        normalization === "imagenet"
          ? (value - IMAGENET_MEAN[channel]!) / IMAGENET_STD[channel]!
          : value;
    }
  }
  return output;
};

export const extractContentDepth = (
  depth: Float32Array,
  modelWidth: number,
  modelHeight: number,
  content: { x: number; y: number; width: number; height: number },
): Float32Array => {
  const out = new Float32Array(content.width * content.height);
  for (let row = 0; row < content.height; row += 1) {
    const srcRow = content.y + row;
    for (let col = 0; col < content.width; col += 1) {
      out[row * content.width + col] =
        depth[srcRow * modelWidth + (content.x + col)]!;
    }
  }
  return out;
};

/** Normalize depth to 0..1 (higher = closer / more relief). */
export const normalizeDepth01 = (depth: Float32Array): Float32Array => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < depth.length; i += 1) {
    const value = depth[i]!;
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const out = new Float32Array(depth.length);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    out.fill(0.5);
    return out;
  }
  const inv = 1 / (max - min);
  for (let i = 0; i < depth.length; i += 1) {
    const value = depth[i]!;
    out[i] = Number.isFinite(value) ? (value - min) * inv : 0.5;
  }
  return out;
};

type CanvasScratch = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

const createScratch = (width: number, height: number): CanvasScratch => {
  const canvas =
    typeof OffscreenCanvas === "undefined"
      ? Object.assign(document.createElement("canvas"), { width, height })
      : new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("2D canvas context unavailable for depth preprocess");
  return { canvas, context };
};

export class DepthEstimator {
  private session: ort.InferenceSession | null = null;
  private device: DepthDevice = "wasm";
  private initPromise: Promise<void> | null = null;
  private model: DepthModelSpec = DEFAULT_DEPTH_MODEL;
  private loadMs = 0;
  private webGpuError: string | null = null;
  private scratch: CanvasScratch | null = null;

  get isReady(): boolean {
    return this.session !== null;
  }

  get activeDevice(): DepthDevice {
    return this.device;
  }

  get lastWebGpuError(): string | null {
    return this.webGpuError;
  }

  get modelSpec(): DepthModelSpec {
    return this.model;
  }

  async initialize(
    model: DepthModelSpec = DEFAULT_DEPTH_MODEL,
    options?: {
      preferWebGpu?: boolean;
      onProgress?: (progress: DepthProgress) => void;
      signal?: AbortSignal;
    },
  ): Promise<DepthDevice> {
    if (this.session && this.model.id === model.id) return this.device;
    if (this.initPromise) {
      await this.initPromise;
      if (this.session && this.model.id === model.id) return this.device;
    }

    this.model = model;
    this.initPromise = this.createSession(model, options);
    try {
      await this.initPromise;
      return this.device;
    } finally {
      this.initPromise = null;
    }
  }

  private async createSession(
    model: DepthModelSpec,
    options?: {
      preferWebGpu?: boolean;
      onProgress?: (progress: DepthProgress) => void;
      signal?: AbortSignal;
    },
  ): Promise<void> {
    ort.env.logLevel = "error";
    ort.env.wasm.wasmPaths = DEFAULT_ORT_WASM_PATHS;
    ort.env.wasm.numThreads = 1;

    options?.onProgress?.({ phase: "loading-model" });
    const loadStarted = performance.now();
    const bytes = await fetchModelBytes(model.url, {
      signal: options?.signal,
      onProgress: (loadedBytes, totalBytes) => {
        options?.onProgress?.({
          phase: "loading-model",
          loadedBytes,
          totalBytes,
        });
      },
    });
    this.loadMs = performance.now() - loadStarted;

    const preferWebGpu = options?.preferWebGpu !== false;
    const providers: DepthDevice[] = preferWebGpu
      ? ["webgpu", "wasm"]
      : ["wasm"];

    let lastError: unknown = null;
    for (const ep of providers) {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        this.session = await ort.InferenceSession.create(bytes, {
          executionProviders: [ep],
          logSeverityLevel: 3,
        });
        this.device = ep;
        return;
      } catch (err) {
        lastError = err;
        this.session = null;
        if (ep === "webgpu") {
          this.webGpuError = formatOrtError(err);
          console.warn("[DepthEstimator] WebGPU init failed, trying WASM:", err);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to init DepthEstimator: ${String(lastError)}`);
  }

  async estimate(
    source: CanvasImageSource,
    options?: {
      onProgress?: (progress: DepthProgress) => void;
      signal?: AbortSignal;
    },
  ): Promise<DepthEstimateResult> {
    if (!this.session) await this.initialize(this.model, options);
    const session = this.session;
    if (!session) throw new Error("DepthEstimator session missing");
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    options?.onProgress?.({ phase: "estimating" });

    const { width: modelWidth, height: modelHeight, normalization } = this.model;
    this.scratch ??= createScratch(modelWidth, modelHeight);
    const { canvas, context } = this.scratch;
    if (canvas.width !== modelWidth || canvas.height !== modelHeight) {
      canvas.width = modelWidth;
      canvas.height = modelHeight;
    }

    const sourceSize = getSourceSize(source);
    const content = containLetterbox(
      sourceSize.width,
      sourceSize.height,
      modelWidth,
      modelHeight,
    );

    context.fillStyle = "#000000";
    context.fillRect(0, 0, modelWidth, modelHeight);
    context.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in context) {
      context.imageSmoothingQuality = "high";
    }
    context.drawImage(
      source,
      0,
      0,
      sourceSize.width,
      sourceSize.height,
      content.x,
      content.y,
      content.width,
      content.height,
    );

    const { data: rgba } = context.getImageData(0, 0, modelWidth, modelHeight);
    const nchw = rgbaToNchw(rgba, modelWidth, modelHeight, normalization);
    const inputName = session.inputNames[0] ?? this.model.inputName;
    const outputName = session.outputNames[0] ?? this.model.outputName;
    const inputTensor = new ort.Tensor("float32", nchw, [
      1,
      3,
      modelHeight,
      modelWidth,
    ]);

    const t0 = performance.now();
    const results = await session.run({ [inputName]: inputTensor });
    const inferenceMs = performance.now() - t0;
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const outputTensor = results[outputName];
    if (!outputTensor) {
      throw new Error(`Missing depth output "${outputName}"`);
    }

    const raw = flattenDepthOutput(
      outputTensor.data as Float32Array,
      outputTensor.dims.map(Number),
      modelWidth,
      modelHeight,
    );
    const depth = extractContentDepth(raw, modelWidth, modelHeight, content);

    options?.onProgress?.({
      phase: "ready",
      inferenceMs,
      device: this.device,
    });

    return {
      depth,
      width: content.width,
      height: content.height,
      content,
      inferenceMs,
      loadMs: this.loadMs,
      device: this.device,
      modelId: this.model.id,
    };
  }

  dispose(): void {
    void this.session?.release();
    this.session = null;
    this.scratch = null;
  }
}

const getSourceSize = (source: CanvasImageSource) => {
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    source instanceof HTMLCanvasElement
  ) {
    return { width: source.width, height: source.height };
  }
  if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
    return { width: source.width, height: source.height };
  }
  if (
    typeof ImageBitmap !== "undefined" &&
    source instanceof ImageBitmap
  ) {
    return { width: source.width, height: source.height };
  }
  const maybe = source as { width?: number; height?: number };
  return {
    width: Number(maybe.width ?? 0),
    height: Number(maybe.height ?? 0),
  };
};

const flattenDepthOutput = (
  data: Float32Array,
  dims: number[],
  expectedWidth: number,
  expectedHeight: number,
): Float32Array => {
  if (dims.length === 4) {
    // [1, 1, H, W] or [1, H, W, 1]
    const d1 = dims[1]!;
    const d2 = dims[2]!;
    const d3 = dims[3]!;
    if (d1 === 1 && d2 === expectedHeight && d3 === expectedWidth) {
      return data.length === expectedWidth * expectedHeight
        ? data
        : data.slice(0, expectedWidth * expectedHeight);
    }
  }
  if (dims.length === 3) {
    // [1, H, W]
    const height = dims[1]!;
    const width = dims[2]!;
    if (height === expectedHeight && width === expectedWidth) {
      return data.length === width * height ? data : data.slice(0, width * height);
    }
  }
  if (dims.length === 2) {
    const height = dims[0]!;
    const width = dims[1]!;
    if (height === expectedHeight && width === expectedWidth) {
      return data.length === width * height ? data : data.slice(0, width * height);
    }
  }

  // Best-effort: take the trailing HxW plane.
  const plane = expectedWidth * expectedHeight;
  if (data.length >= plane) {
    return data.subarray(data.length - plane);
  }
  throw new Error(
    `Unexpected depth output dims [${dims.join(", ")}]; expected ~${expectedHeight}x${expectedWidth}`,
  );
};

const fetchModelBytes = async (
  url: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (loaded: number, total?: number) => void;
  },
): Promise<Uint8Array> => {
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`Depth model failed to load (HTTP ${response.status})`);
  }

  const total = Number(response.headers.get("content-length")) || undefined;
  if (!response.body || !options?.onProgress) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    options.onProgress(loaded, total);
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Shared singleton so photo switches reuse the downloaded session. */
let sharedEstimator: DepthEstimator | null = null;

export const getSharedDepthEstimator = (): DepthEstimator => {
  sharedEstimator ??= new DepthEstimator();
  return sharedEstimator;
};
