"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomablePreviewFrame } from "@/components/editor/previews/ZoomablePreviewFrame";
import {
  drawImageDataToCanvas,
  type CanvasPreviewMode,
} from "@/lib/canvas-preview";
import { buildLayerOverlay } from "@/lib/v2/composite";
import { useV2State } from "@/lib/v2/v2-context";
import type { V2ViewMode } from "@/lib/v2/types";
import type { V2CompositeResult } from "@/lib/v2/worker-types";
import { cn } from "@/lib/utils";

type Props = {
  compositeResult: V2CompositeResult | null;
  labels: Uint8Array | null;
  view: V2ViewMode;
};

const HQ_SETTLE_MS = 160;

const PreviewModeTabs = ({
  previewMode,
  onPreviewModeChange,
}: {
  previewMode: CanvasPreviewMode;
  onPreviewModeChange: (mode: CanvasPreviewMode) => void;
}) => (
  <div className="pointer-events-auto absolute right-2 top-2 z-10">
    <div
      className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-background/85 p-1 backdrop-blur-sm"
      role="tablist"
      aria-label="Preview zoom mode"
    >
      {(
        [
          { id: "fit", label: "Fit" },
          { id: "pixel-perfect", label: "1:1 px" },
        ] as const
      ).map(({ id, label }) => {
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
                ? "Fit preview to panel"
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

export const V2Preview = ({ compositeResult, labels, view }: Props) => {
  const { workingImageData, isReady, skyDetect } = useV2State();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactingRef = useRef(false);
  const displayImageRef = useRef<ImageData | null>(null);
  const previewModeRef = useRef<CanvasPreviewMode>("fit");

  const [previewMode, setPreviewMode] = useState<CanvasPreviewMode>("fit");

  const displayImage = useMemo(() => {
    if (!workingImageData) return null;
    if (view === "source") return workingImageData;
    if (view === "mask" && labels) {
      return buildLayerOverlay(workingImageData, labels);
    }
    if (view === "result" && compositeResult) {
      return new ImageData(
        new Uint8ClampedArray(compositeResult.buffer),
        compositeResult.width,
        compositeResult.height,
      );
    }
    return workingImageData;
  }, [workingImageData, labels, view, compositeResult]);

  useEffect(() => {
    displayImageRef.current = displayImage;
  }, [displayImage]);

  useEffect(() => {
    previewModeRef.current = previewMode;
  }, [previewMode]);

  const drawPreview = useCallback((hq: boolean) => {
    const canvas = canvasRef.current;
    const image = displayImageRef.current;
    if (!canvas || !image) return;
    drawImageDataToCanvas(canvas, image, {
      mode: previewModeRef.current,
      fillStyle: "#000",
      highQualityDownsample: hq && previewModeRef.current === "fit",
    });
  }, []);

  const scheduleHqRedraw = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      if (interactingRef.current) return;
      drawPreview(true);
    }, HQ_SETTLE_MS);
  }, [drawPreview]);

  const handleInteractionChange = useCallback(
    (active: boolean) => {
      interactingRef.current = active;
      if (active) {
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        drawPreview(false);
        return;
      }
      scheduleHqRedraw();
    },
    [drawPreview, scheduleHqRedraw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayImage) return;

    drawPreview(false);
    if (!interactingRef.current) scheduleHqRedraw();

    const observer = new ResizeObserver(() => {
      drawPreview(!interactingRef.current);
      if (!interactingRef.current) scheduleHqRedraw();
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [displayImage, previewMode, drawPreview, scheduleHqRedraw]);

  const loadingLabel =
    skyDetect.status === "loading" || skyDetect.status === "running"
      ? skyDetect.status === "loading"
        ? "Loading sky model…"
        : "Detecting sky…"
      : "Loading…";

  return (
    <div className="absolute inset-0">
      {isReady ? (
        <PreviewModeTabs
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
        />
      ) : null}
      <ZoomablePreviewFrame
        gesturesEnabled
        onInteractionChange={handleInteractionChange}
      >
        <div className="relative h-full w-full bg-black">
          {!isReady ? (
            <div
              className="flex h-full items-center justify-center text-sm text-muted-foreground"
              aria-label="Loading image"
            >
              {loadingLabel}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              style={{
                imageRendering:
                  previewMode === "pixel-perfect" ? "pixelated" : "auto",
              }}
              aria-label={
                view === "result"
                  ? "Dither result preview"
                  : view === "mask"
                    ? "Layer mask preview"
                    : "Image preview"
              }
            />
          )}
          {isReady &&
          (skyDetect.status === "loading" || skyDetect.status === "running") ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2"
              aria-live="polite"
            >
              <span className="rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                {loadingLabel}
              </span>
            </div>
          ) : null}
        </div>
      </ZoomablePreviewFrame>
    </div>
  );
};
