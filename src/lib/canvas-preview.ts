"use client";

export type CanvasPreviewMode = "fit" | "pixel-perfect";

type DrawImageDataOptions = {
  mode: CanvasPreviewMode;
  fillStyle?: string;
  highQualityDownsample?: boolean;
};

type DrawBufferOptions = DrawImageDataOptions & {
  buffer: ArrayBuffer;
  width: number;
  height: number;
};

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const progressiveDownsample = (
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement => {
  let current = source;
  let currentW = source.width;
  let currentH = source.height;

  while (currentW * 0.5 >= targetW && currentH * 0.5 >= targetH) {
    const nextW = Math.max(targetW, Math.floor(currentW * 0.5));
    const nextH = Math.max(targetH, Math.floor(currentH * 0.5));
    const next = createCanvas(nextW, nextH);
    const nextCtx = next.getContext("2d");
    if (!nextCtx) break;
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = "high";
    nextCtx.drawImage(current, 0, 0, currentW, currentH, 0, 0, nextW, nextH);
    current = next;
    currentW = nextW;
    currentH = nextH;
  }

  if (currentW === targetW && currentH === targetH) return current;

  const finalCanvas = createCanvas(targetW, targetH);
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) return current;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = "high";
  finalCtx.drawImage(current, 0, 0, currentW, currentH, 0, 0, targetW, targetH);
  return finalCanvas;
};

export const drawImageDataToCanvas = (
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  options: DrawImageDataOptions
): void => {
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  canvas.width = pxW;
  canvas.height = pxH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (options.fillStyle) {
    ctx.fillStyle = options.fillStyle;
    ctx.fillRect(0, 0, pxW, pxH);
  } else {
    ctx.clearRect(0, 0, pxW, pxH);
  }

  const srcW = imageData.width;
  const srcH = imageData.height;
  if (srcW <= 0 || srcH <= 0) return;

  const srcCanvas = createCanvas(srcW, srcH);
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return;
  srcCtx.putImageData(imageData, 0, 0);

  let drawW = srcW;
  let drawH = srcH;
  if (options.mode === "fit") {
    const scale = Math.min(pxW / srcW, pxH / srcH);
    drawW = Math.max(1, Math.round(srcW * scale));
    drawH = Math.max(1, Math.round(srcH * scale));
  }

  const x = Math.floor((pxW - drawW) * 0.5);
  const y = Math.floor((pxH - drawH) * 0.5);

  const shouldDownsample =
    options.mode === "fit" &&
    options.highQualityDownsample &&
    (drawW < srcW || drawH < srcH);

  if (shouldDownsample) {
    const downsampled = progressiveDownsample(srcCanvas, drawW, drawH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(downsampled, x, y);
    return;
  }

  ctx.imageSmoothingEnabled = options.mode === "fit" && (drawW > srcW || drawH > srcH);
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, srcW, srcH, x, y, drawW, drawH);
};

export const drawRgbaBufferToCanvas = (
  canvas: HTMLCanvasElement,
  options: DrawBufferOptions
): void => {
  const { buffer, width, height, mode, fillStyle, highQualityDownsample } = options;
  if (width <= 0 || height <= 0 || buffer.byteLength < width * height * 4) return;
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
  drawImageDataToCanvas(canvas, imageData, {
    mode,
    fillStyle,
    highQualityDownsample,
  });
};
