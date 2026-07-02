"use client";

import { useEffect, useRef } from "react";
import { useHistogramResult } from "@/lib/processing-worker-context";

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 80;

export type HistogramMode = "smooth" | "raw";

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
  let dataMax = 0;
  for (let i = 0; i < 256; i++) {
    if (r[i] > dataMax) dataMax = r[i];
    if (g[i] > dataMax) dataMax = g[i];
    if (b[i] > dataMax) dataMax = b[i];
  }
  if (dataMax <= 0) return false;
  return true;
};

const maxOfBins = (a: number[], b: number[], c: number[], fallback: number): number => {
  let max = fallback;
  for (let i = 0; i < 256; i++) {
    if (a[i] > max) max = a[i];
    if (b[i] > max) max = b[i];
    if (c[i] > max) max = c[i];
  }
  return max;
};

type Props = {
  mode?: HistogramMode;
};

const smoothBins = (bins: number[]): number[] => {
  if (bins.length !== 256) return bins;
  const out = new Array<number>(256).fill(0);
  for (let i = 0; i < 256; i++) {
    const a = bins[Math.max(0, i - 2)];
    const b = bins[Math.max(0, i - 1)];
    const c = bins[i];
    const d = bins[Math.min(255, i + 1)];
    const e = bins[Math.min(255, i + 2)];
    out[i] = (a + 4 * b + 6 * c + 4 * d + e) / 16;
  }
  return out;
};

export const Histogram = ({ mode = "smooth" }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastValidRef = useRef<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const histogramResult = useHistogramResult();
  const smooth = mode === "smooth";

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

    const sourceR = smooth ? smoothBins(dataToDraw.r) : dataToDraw.r;
    const sourceG = smooth ? smoothBins(dataToDraw.g) : dataToDraw.g;
    const sourceB = smooth ? smoothBins(dataToDraw.b) : dataToDraw.b;
    const rawMax = maxOfBins(sourceR, sourceG, sourceB, 1);
    if (!Number.isFinite(rawMax) || rawMax <= 0) return;

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

    drawChannel(sourceB, "rgba(100, 140, 255, 0.45)");
    drawChannel(sourceG, "rgba(80, 220, 100, 0.45)");
    drawChannel(sourceR, "rgba(255, 90, 90, 0.45)");
  }, [histogramResult, smooth]);

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
