/**
 * Lab sky detector — DOM helpers + canvas wrapper around the shared core.
 */
import {
  SkyDetector as CoreSkyDetector,
  type SkyDetectResult,
  type SkyDetectDevice,
} from "@/lib/sky/sky-detector";

export {
  DEFAULT_MODEL_URL,
  DEFAULT_ORT_WASM_PATHS,
  DEFAULT_MAX_LONG_EDGE,
  DEFAULT_SKY_REFINE,
  skyMaskFromMargin,
  floodSkyIntoBright,
  includeMoreToThreshold,
  brightFillToGates,
  refineSkyMask,
  type SkyDetectDevice,
  type SkyDetectResult,
  type SkyRefineParams,
} from "@/lib/sky/sky-detector";

/** Lab wrapper: accepts an HTMLCanvasElement, delegates to the DOM-free core. */
export class SkyDetector {
  private readonly core = new CoreSkyDetector();

  get isReady(): boolean {
    return this.core.isReady;
  }

  get activeDevice(): SkyDetectDevice {
    return this.core.activeDevice;
  }

  get lastWebGpuError(): string | null {
    return this.core.lastWebGpuError;
  }

  async initialize(
    modelUrl?: string,
    options?: { preferWebGpu?: boolean },
  ): Promise<SkyDetectDevice> {
    return this.core.initialize(modelUrl, options);
  }

  async generateSkyMask(
    canvas: HTMLCanvasElement,
    options?: { maxLongEdge?: number },
  ): Promise<SkyDetectResult> {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D context unavailable");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return this.core.generateSkyMask(
      { rgba: img.data, width: canvas.width, height: canvas.height },
      options,
    );
  }
}

/** Apply binary sky mask to source RGBA → sky-only or non-sky-only preview. */
export const compositeMaskedPreview = (
  sourceRgba: Uint8ClampedArray,
  skyMask: Uint8ClampedArray,
  mode: "sky" | "non-sky",
  background: [number, number, number] = [18, 18, 18],
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(sourceRgba.length);
  const keepSky = mode === "sky";
  for (let i = 0; i < skyMask.length; i++) {
    const isSky = skyMask[i] > 127;
    const keep = keepSky ? isSky : !isSky;
    const o = i * 4;
    if (keep) {
      out[o] = sourceRgba[o];
      out[o + 1] = sourceRgba[o + 1];
      out[o + 2] = sourceRgba[o + 2];
      out[o + 3] = 255;
    } else {
      out[o] = background[0];
      out[o + 1] = background[1];
      out[o + 2] = background[2];
      out[o + 3] = 255;
    }
  }
  return out;
};

export const imageDataToObjectUrl = (imageData: ImageData): string => {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export const loadImageToCanvas = async (
  src: string,
): Promise<HTMLCanvasElement> => {
  const img = await loadHtmlImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(img, 0, 0);
  return canvas;
};

const loadHtmlImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
