"use client";

import { useEffect, useRef, useState } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import { useProcessingWorkerContext } from "@/lib/processing-worker-context";
import { Label } from "@/components/ui/label";

type Props = {
  processedImageData: ImageData | null;
};

type ChannelKind = "rgb" | "r" | "g" | "b";

const CHANNEL_CELLS: { kind: ChannelKind; label: string }[] = [
  { kind: "r", label: "R" },
  { kind: "g", label: "G" },
  { kind: "b", label: "B" },
  { kind: "rgb", label: "RGB" },
];

const INCOMING_CSS = 200;

const drawImageDataFit = (
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  cssW: number,
  cssH: number
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx || cssW <= 0 || cssH <= 0) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  canvas.width = pxW;
  canvas.height = pxH;
  const { width: srcW, height: srcH } = imageData;
  const scale = Math.min(pxW / srcW, pxH / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const offscreen = document.createElement("canvas");
  offscreen.width = srcW;
  offscreen.height = srcH;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.imageSmoothingEnabled = false;
  const x = (pxW - drawW) / 2;
  const y = (pxH - drawH) / 2;
  ctx.drawImage(offscreen, 0, 0, srcW, srcH, x, y, drawW, drawH);
};

const drawBufferFit = (
  canvas: HTMLCanvasElement,
  buffer: ArrayBuffer,
  width: number,
  height: number,
  cssW: number,
  cssH: number
) => {
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
  drawImageDataFit(canvas, imageData, cssW, cssH);
};

const IncomingCell = ({ imageData }: { imageData: ImageData | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    drawImageDataFit(canvas, imageData, INCOMING_CSS, INCOMING_CSS);
  }, [imageData]);

  if (!imageData) return null;

  return (
    <div
      className="absolute left-0 top-0 z-10 flex flex-col gap-1 rounded-md border border-border bg-background/95 p-2 shadow-md"
      style={{ width: INCOMING_CSS, height: INCOMING_CSS + 24 }}
    >
      <Label className="shrink-0 text-xs font-medium text-muted-foreground">
        Incoming
      </Label>
      <div className="min-h-0 flex-1 overflow-hidden rounded border border-border bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ display: "block" }}
          aria-label="Incoming image before dither"
        />
      </div>
    </div>
  );
};

const DitherChannelCell = ({
  kind,
  label,
  buffer,
  width,
  height,
}: {
  kind: ChannelKind;
  label: string;
  buffer: ArrayBuffer | null;
  width: number;
  height: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      setSize({ w: Math.max(0, Math.floor(w)), h: Math.max(0, Math.floor(h)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer || width <= 0 || height <= 0 || size.w <= 0 || size.h <= 0) return;
    drawBufferFit(canvas, buffer, width, height, size.w, size.h);
  }, [kind, buffer, width, height, size.w, size.h]);

  return (
    <div
      ref={wrapRef}
      className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded border border-border bg-black p-1"
      role="gridcell"
    >
      <Label className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative min-h-0 min-w-0 flex-1 self-stretch">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label={`Dither channel ${label}`}
        />
      </div>
    </div>
  );
};

export const DitherPreview = ({ processedImageData }: Props) => {
  const { ditherResult } = useProcessingWorkerContext();

  const getBufferForKind = (
    kind: ChannelKind
  ): { buffer: ArrayBuffer; width: number; height: number } | null => {
    if (!ditherResult) return null;
    const { width, height, rgbBuffer, rBuffer, gBuffer, bBuffer } = ditherResult;
    switch (kind) {
      case "rgb":
        return { buffer: rgbBuffer, width, height };
      case "r":
        return { buffer: rBuffer, width, height };
      case "g":
        return { buffer: gBuffer, width, height };
      case "b":
        return { buffer: bBuffer, width, height };
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <IncomingCell imageData={processedImageData} />

      <div
        className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1 p-1"
        style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}
        role="grid"
        aria-label="Dither channel preview grid"
      >
        {CHANNEL_CELLS.map(({ kind, label }) => {
          const data = getBufferForKind(kind);
          return (
            <DitherChannelCell
              key={kind}
              kind={kind}
              label={label}
              buffer={data?.buffer ?? null}
              width={data?.width ?? 0}
              height={data?.height ?? 0}
            />
          );
        })}
      </div>
    </div>
  );
};
