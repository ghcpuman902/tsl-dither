"use client";

import { useEffect, useRef } from "react";
import type { PipelineOutput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { drawRgbaBufferToCanvas, type CanvasPreviewMode } from "@/lib/canvas-preview";

type Props = {
  pipelineOutput: PipelineOutput | null;
  mode?: CanvasPreviewMode;
  className?: string;
  "aria-label"?: string;
};

const drawPipelineOutputFit = (
  canvas: HTMLCanvasElement,
  pipelineOutput: PipelineOutput | null,
  mode: CanvasPreviewMode
): void => {
  if (!pipelineOutput) {
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    if (cssW <= 0 || cssH <= 0) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  drawRgbaBufferToCanvas(canvas, {
    buffer: pipelineOutput.buffer,
    width: pipelineOutput.width,
    height: pipelineOutput.height,
    mode,
    fillStyle: "#000",
    highQualityDownsample: true,
  });
};

export const PipelineOutputFitCanvas = ({
  pipelineOutput,
  mode = "fit",
  className,
  "aria-label": ariaLabel = "Pipeline output preview",
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      drawPipelineOutputFit(canvas, pipelineOutput, mode);
    };

    redraw();
    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [pipelineOutput, mode]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full", className)}
      aria-label={ariaLabel}
      role="img"
    />
  );
};
