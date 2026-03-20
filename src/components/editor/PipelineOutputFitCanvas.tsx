"use client";

import { useEffect, useRef } from "react";
import type { PipelineOutput } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  pipelineOutput: PipelineOutput | null;
  className?: string;
  "aria-label"?: string;
};

const drawPipelineOutputFit = (
  canvas: HTMLCanvasElement,
  pipelineOutput: PipelineOutput | null
): void => {
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  canvas.width = pxW;
  canvas.height = pxH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, pxW, pxH);

  if (!pipelineOutput || pipelineOutput.width <= 0 || pipelineOutput.height <= 0) {
    return;
  }

  const { width: srcW, height: srcH, buffer } = pipelineOutput;
  if (buffer.byteLength < srcW * srcH * 4) {
    return;
  }

  const imageData = new ImageData(new Uint8ClampedArray(buffer), srcW, srcH);
  const off = document.createElement("canvas");
  off.width = srcW;
  off.height = srcH;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);

  const scale = Math.min(pxW / srcW, pxH / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const x = (pxW - drawW) / 2;
  const y = (pxH - drawH) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, srcW, srcH, x, y, drawW, drawH);
};

export const PipelineOutputFitCanvas = ({
  pipelineOutput,
  className,
  "aria-label": ariaLabel = "Pipeline output preview",
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      drawPipelineOutputFit(canvas, pipelineOutput);
    };

    redraw();
    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [pipelineOutput]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full", className)}
      aria-label={ariaLabel}
      role="img"
    />
  );
};
