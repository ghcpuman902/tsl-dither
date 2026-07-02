"use client";

import { memo, useContext, useEffect, useRef, useState, createContext } from "react";
import { usePipelineState } from "@/lib/pipeline-context";
import { useDitherResult } from "@/lib/processing-worker-context";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { drawImageDataToCanvas, drawRgbaBufferToCanvas, type CanvasPreviewMode } from "@/lib/canvas-preview";
import { drawDitherPreviewGpu } from "@/lib/gpu-dither-preview";
import type { DitherParams } from "@/lib/types";

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

const DitherPreviewModeContext = createContext<CanvasPreviewMode>("fit");

const useDitherPreviewMode = (): CanvasPreviewMode => useContext(DitherPreviewModeContext);

const IncomingCell = ({ imageData }: { imageData: ImageData | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    drawImageDataToCanvas(canvas, imageData, {
      mode: "fit",
      highQualityDownsample: true,
    });
  }, [imageData]);

  if (!imageData) return null;

  return (
    <div
      className="absolute left-0 top-0 z-10 flex flex-col gap-0 opacity-100"
      style={{ width: INCOMING_CSS, height: INCOMING_CSS + 24 }}
    >
      <Label className="shrink-0 text-xs font-medium text-muted-foreground mb-0 absolute left-0 top-0 z-11">
        Incoming
      </Label>
      <div className="min-h-0 flex-1 overflow-hidden bg-black/50 backdrop-blur-sm relative">
        <canvas
          ref={canvasRef}
          className="h-full w-full block"
          aria-label="Incoming image before dither"
        />
      </div>
    </div>
  );
};

type DitherChannelCellProps = {
  kind: ChannelKind;
  label: string;
  buffer: ArrayBuffer | null;
  width: number;
  height: number;
  sourceImage: ImageData | null;
  ditherParams: DitherParams;
};

const DitherChannelCell = memo(function DitherChannelCell({
  kind,
  label,
  buffer,
  width,
  height,
  sourceImage,
  ditherParams,
}: DitherChannelCellProps) {
  const previewMode = useDitherPreviewMode();
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
    if (!canvas || size.w <= 0 || size.h <= 0) return;
    if (sourceImage) {
      const rendered = drawDitherPreviewGpu(canvas, sourceImage, ditherParams, kind, {
        mode: previewMode,
      });
      if (rendered) return;
    }
    if (!buffer || width <= 0 || height <= 0) return;
    drawRgbaBufferToCanvas(canvas, {
      buffer,
      width,
      height,
      mode: previewMode,
      highQualityDownsample: true,
    });
  }, [kind, buffer, width, height, size.w, size.h, previewMode, sourceImage, ditherParams]);

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
});

const DitherPreviewModeTabs = ({
  previewMode,
  onPreviewModeChange,
}: {
  previewMode: CanvasPreviewMode;
  onPreviewModeChange: (mode: CanvasPreviewMode) => void;
}) => (
  <div className="absolute right-2 top-2 z-10">
    <div
      className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-background/85 p-1 backdrop-blur-sm"
      role="tablist"
      aria-label="Dither preview zoom mode"
    >
      {([
        { id: "fit", label: "Fit" },
        { id: "pixel-perfect", label: "1:1 px" },
      ] as const).map(({ id, label }) => {
        const selected = previewMode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            aria-label={
              id === "fit"
                ? "Fit all channel previews to panel"
                : "Show one source pixel per screen pixel"
            }
            onClick={() => onPreviewModeChange(id)}
            className={cn(
              "rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  </div>
);

const DitherPreviewGrid = ({
  processedImageData,
  ditherParams,
}: {
  processedImageData: ImageData | null;
  ditherParams: DitherParams;
}) => {
  const ditherResult = useDitherResult();

  const getBufferForKind = (
    kind: ChannelKind,
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
            sourceImage={processedImageData}
            ditherParams={ditherParams}
          />
        );
      })}
    </div>
  );
};

export const DitherPreview = ({ processedImageData }: Props) => {
  const { state } = usePipelineState();
  const [previewMode, setPreviewMode] = useState<CanvasPreviewMode>("fit");

  return (
    <DitherPreviewModeContext.Provider value={previewMode}>
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        <IncomingCell imageData={processedImageData} />
        <DitherPreviewModeTabs
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
        />
        <DitherPreviewGrid
          processedImageData={processedImageData}
          ditherParams={state.dither}
        />
      </div>
    </DitherPreviewModeContext.Provider>
  );
};
