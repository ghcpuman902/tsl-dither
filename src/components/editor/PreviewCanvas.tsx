"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import { applyTone } from "@/lib/tone-processor";
import { renderToneGPU, disposeGPU } from "@/lib/tone-renderer-webgl";
import { DEFAULT_TONE_PARAMS, DEFAULT_TONE_VISIBLE } from "@/lib/types";

type Props = {
  onProcessed?: (imageData: ImageData) => void;
};

const LOAD_TONE_VISIBLE = {
  ...DEFAULT_TONE_VISIBLE,
  exposure: false,
  contrast: false,
  highlights: false,
  shadows: false,
  whites: false,
  blacks: false,
  saturation: false,
  temperature: false,
} as const;

const HISTOGRAM_DEBOUNCE_MS = 200;

const isValidProcessedFrame = (img: ImageData): boolean =>
  img.width > 0 &&
  img.height > 0 &&
  img.data.length === img.width * img.height * 4;

export const PreviewCanvas = ({ onProcessed }: Props) => {
  const { state } = usePipeline();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const rafRef = useRef(0);
  const histogramTimerRef = useRef(0);
  const readbackBufferRef = useRef<Uint8ClampedArray | null>(null);
  const lastProcessedRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoadedImg(img);
    img.onerror = () => console.error("Failed to load image:", state.sourceImageSrc);
    img.src = state.sourceImageSrc;
  }, [state.sourceImageSrc]);

  useEffect(() => {
    return () => {
      disposeGPU();
    };
  }, []);

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

    const w = Math.max(1, Math.round(drawW));
    const h = Math.max(1, Math.round(drawH));
    const isLoad = state.activeStage === "load";

    const gpuOk = renderToneGPU({
      canvas,
      image: loadedImg,
      tone: isLoad ? DEFAULT_TONE_PARAMS : state.tone,
      toneVisible: isLoad ? LOAD_TONE_VISIBLE : state.toneVisible,
      viewport: { x: drawX, y: ch - drawY - h, w: drawW, h: drawH },
    });

    if (gpuOk) {
      if (onProcessed) {
        const gl = canvas.getContext("webgl", { alpha: false, premultipliedAlpha: false });
        if (gl) {
          const totalBytes = w * h * 4;
          const readY = Math.round(ch - drawY - h);
          if (totalBytes > 0 && readY >= 0 && readY + h <= ch) {
            if (!readbackBufferRef.current || readbackBufferRef.current.length !== totalBytes) {
              readbackBufferRef.current = new Uint8ClampedArray(totalBytes);
            }
            gl.readPixels(drawX, readY, w, h, gl.RGBA, gl.UNSIGNED_BYTE, readbackBufferRef.current);
            const flipped = new Uint8ClampedArray(totalBytes);
            const rowBytes = w * 4;
            for (let row = 0; row < h; row++) {
              const srcRow = h - 1 - row;
              flipped.set(
                readbackBufferRef.current.subarray(srcRow * rowBytes, (srcRow + 1) * rowBytes),
                row * rowBytes
              );
            }
            lastProcessedRef.current = new ImageData(flipped, w, h);
          }
        }
        window.clearTimeout(histogramTimerRef.current);
        histogramTimerRef.current = window.setTimeout(() => {
          const frame = lastProcessedRef.current;
          if (frame && isValidProcessedFrame(frame)) {
            onProcessed(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height));
          }
        }, HISTOGRAM_DEBOUNCE_MS);
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.drawImage(loadedImg, 0, 0, w, h);

    let imageData = offCtx.getImageData(0, 0, w, h);
    if (!isLoad) {
      imageData = applyTone(imageData, state.tone, state.toneVisible);
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offscreen, drawX, drawY);

    if (onProcessed) {
      lastProcessedRef.current = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      window.clearTimeout(histogramTimerRef.current);
      histogramTimerRef.current = window.setTimeout(() => {
        const frame = lastProcessedRef.current;
        if (frame && isValidProcessedFrame(frame)) {
          onProcessed(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height));
        }
      }, HISTOGRAM_DEBOUNCE_MS);
    }
  }, [loadedImg, state.activeStage, state.tone, state.toneVisible, onProcessed]);

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
      style={{ imageRendering: "auto" }}
    />
  );
};
