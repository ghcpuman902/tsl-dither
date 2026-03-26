"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePipeline } from "@/lib/pipeline-context";

type Props = {
  onProcessed?: (imageData: ImageData) => void;
};

const HISTOGRAM_DEBOUNCE_MS = 200;

const isValidProcessedFrame = (img: ImageData): boolean =>
  img.width > 0 &&
  img.height > 0 &&
  img.data.length === img.width * img.height * 4;

export const PreviewCanvas = ({ onProcessed }: Props) => {
  const { state } = usePipeline();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [pixelatedPreview, setPixelatedPreview] = useState(false);
  const rafRef = useRef(0);
  const histogramTimerRef = useRef(0);
  const lastProcessedRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoadedImg(img);
    img.onerror = () => console.error("Failed to load image:", state.sourceImageSrc);
    img.src = state.sourceImageSrc;
  }, [state.sourceImageSrc]);

  const render = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const imgAspect = loadedImg.naturalWidth / loadedImg.naturalHeight;
    const canvasAspect = cw / ch;

    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > canvasAspect) {
      drawW = cw;
      drawH = cw / imgAspect;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgAspect;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    const sourceW = Math.max(1, loadedImg.naturalWidth);
    const sourceH = Math.max(1, loadedImg.naturalHeight);
    const shouldPixelate = drawW > sourceW || drawH > sourceH;
    setPixelatedPreview((prev) => (prev === shouldPixelate ? prev : shouldPixelate));

    // Keep a stable processing frame for the whole pipeline.
    // When preview is larger than source, process at source resolution.
    const processScale = shouldPixelate
      ? 1
      : Math.min(drawW / sourceW, drawH / sourceH);
    const w = Math.max(1, Math.round(sourceW * processScale));
    const h = Math.max(1, Math.round(sourceH * processScale));
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.imageSmoothingEnabled = !shouldPixelate;
    offCtx.imageSmoothingQuality = "high";
    offCtx.drawImage(loadedImg, 0, 0, sourceW, sourceH, 0, 0, w, h);

    const baseImageData = offCtx.getImageData(0, 0, w, h);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = !shouldPixelate;
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);

    if (onProcessed) {
      lastProcessedRef.current = new ImageData(
        new Uint8ClampedArray(baseImageData.data),
        baseImageData.width,
        baseImageData.height
      );
      window.clearTimeout(histogramTimerRef.current);
      histogramTimerRef.current = window.setTimeout(() => {
        const frame = lastProcessedRef.current;
        if (frame && isValidProcessedFrame(frame)) {
          onProcessed(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height));
        }
      }, HISTOGRAM_DEBOUNCE_MS);
    }
  }, [loadedImg, onProcessed, state.sourceImageSrc]);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") render();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      if (document.visibilityState === "visible") render();
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-label="Image preview"
      style={{ imageRendering: pixelatedPreview ? "pixelated" : "auto" }}
    />
  );
};
