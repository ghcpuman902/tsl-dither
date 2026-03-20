"use client";

import { useEffect, useRef } from "react";
import { useProcessingWorkerContext } from "@/lib/processing-worker-context";

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 80;

const isValidHistogram = (r: number[], g: number[], b: number[]): boolean => {
  if (
    !Array.isArray(r) ||
    !Array.isArray(g) ||
    !Array.isArray(b) ||
    r.length !== 256 ||
    g.length !== 256 ||
    b.length !== 256
  ) {
    return false;
  }
  const allFinite = (arr: number[]) => arr.every((n) => Number.isFinite(n));
  if (!allFinite(r) || !allFinite(g) || !allFinite(b)) return false;
  const dataMax = Math.max(...r, ...g, ...b);
  if (dataMax <= 0) return false;
  return true;
};

export const Histogram = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastValidRef = useRef<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const { histogramResult } = useProcessingWorkerContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const resultValid =
      histogramResult &&
      isValidHistogram(histogramResult.r, histogramResult.g, histogramResult.b);
    const dataToDraw = resultValid ? histogramResult : lastValidRef.current;

    if (!dataToDraw) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    if (resultValid && histogramResult) {
      lastValidRef.current = {
        r: [...histogramResult.r],
        g: [...histogramResult.g],
        b: [...histogramResult.b],
      };
    }

    const { r, g, b } = dataToDraw;
    const rawMax = Math.max(...r, ...g, ...b, 1);
    if (!Number.isFinite(rawMax) || rawMax <= 0) return;

    // Log scale: log(count + 1) / log(rawMax + 1) keeps small peaks visible
    // even when one extreme bin dominates (e.g. solid black region).
    const logMax = Math.log(rawMax + 1);
    const toY = (count: number) => h - (Math.log(count + 1) / logMax) * h;

    ctx.clearRect(0, 0, w, h);

    const drawChannel = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        ctx.lineTo(x, toY(data[i]));
      }

      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    drawChannel(b, "rgba(100, 140, 255, 0.45)");
    drawChannel(g, "rgba(80, 220, 100, 0.45)");
    drawChannel(r, "rgba(255, 90, 90, 0.45)");
  }, [histogramResult]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="min-h-[80px] w-full rounded"
      style={{ minHeight: 80 }}
      aria-label="RGB histogram"
    />
  );
};
