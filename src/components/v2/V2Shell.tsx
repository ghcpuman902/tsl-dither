"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { DialRoot } from "dialkit";
import { LayoutGrid } from "lucide-react";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { refineSkyMask } from "@/lib/sky/sky-detector";
import { labelsFromSkyMask } from "@/lib/v2/labels";
import { useV2Actions, useV2State } from "@/lib/v2/v2-context";
import { useV2Coordinator } from "@/lib/v2/use-v2-coordinator";
import {
  useV2Dials,
  V2_UPLOADED_SOURCE_VALUE,
} from "@/lib/v2/use-v2-dials";
import type { V2ViewMode } from "@/lib/v2/types";
import { V2Preview } from "./V2Preview";

const VIEW_OPTIONS: { id: V2ViewMode; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "mask", label: "Layers" },
  { id: "result", label: "Result" },
];

export const V2Shell = () => {
  const { state, workingImageData, detection, skyDetect, filename } =
    useV2State();
  const { setView, setSourceSrc, setSourceFromFile, redetect, setWorkingMaxLongEdge, setMaskMaxLongEdge } =
    useV2Actions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compositeResultRef = useRef<{
    buffer: ArrayBuffer;
    width: number;
    height: number;
  } | null>(null);

  const isUploaded = state.sourceImageSrc.startsWith("blob:");

  const handleExport = useCallback(() => {
    const result = compositeResultRef.current;
    if (!result) return;
    const imageData = new ImageData(
      new Uint8ClampedArray(result.buffer),
      result.width,
      result.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "v2-dither.png";
    link.href = dataUrl;
    link.click();
  }, []);

  const dialActions = useMemo(
    () => ({
      onLoadImage: () => fileInputRef.current?.click(),
      onRedetect: () => redetect(),
      onExport: handleExport,
    }),
    [redetect, handleExport],
  );

  const dials = useV2Dials(dialActions, {
    isUploaded,
    currentSourceSrc: state.sourceImageSrc,
  });
  const setDialSourceRef = useRef(dials.setSourceValue);
  const prevDialSourceRef = useRef(dials.values.source);

  useEffect(() => {
    setDialSourceRef.current = dials.setSourceValue;
  }, [dials.setSourceValue]);

  // Keep dial select in sync when source changes from outside (file upload / restore).
  useEffect(() => {
    const target = isUploaded
      ? V2_UPLOADED_SOURCE_VALUE
      : state.sourceImageSrc;
    setDialSourceRef.current(target);
  }, [state.sourceImageSrc, isUploaded]);

  // Sample select → load that sample. Only when the dial value itself changes —
  // not when state.sourceImageSrc flips to a blob while the dial still shows
  // the previous sample (that race revoked the blob mid-decode on large files).
  useEffect(() => {
    const src = dials.values.source;
    if (src === prevDialSourceRef.current) return;
    prevDialSourceRef.current = src;

    if (src === V2_UPLOADED_SOURCE_VALUE) return;
    if (src === state.sourceImageSrc) return;
    setSourceSrc(src);
  }, [dials.values.source, state.sourceImageSrc, setSourceSrc]);

  // Output resolution (0 = native). Mask inference size is independent.
  useEffect(() => {
    setWorkingMaxLongEdge(dials.values.image.maxLongEdge);
  }, [dials.values.image.maxLongEdge, setWorkingMaxLongEdge]);

  useEffect(() => {
    setMaskMaxLongEdge(dials.values.sky.maxLongEdge);
  }, [dials.values.sky.maxLongEdge, setMaskMaxLongEdge]);

  const labels = useMemo(() => {
    if (!workingImageData || !detection) return null;
    if (
      detection.width !== workingImageData.width ||
      detection.height !== workingImageData.height
    ) {
      return null;
    }
    const mask = refineSkyMask(
      detection.skyMargin,
      workingImageData.data,
      workingImageData.width,
      workingImageData.height,
      {
        includeMore: dials.values.sky.includeMore,
        brightFill: dials.values.sky.brightFill,
      },
    );
    return labelsFromSkyMask(mask);
  }, [
    workingImageData,
    detection,
    dials.values.sky.includeMore,
    dials.values.sky.brightFill,
  ]);

  const { compositeResult } = useV2Coordinator(
    workingImageData,
    labels,
    dials.layerParams,
  );

  useEffect(() => {
    compositeResultRef.current = compositeResult;
  }, [compositeResult]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDialSourceRef.current(V2_UPLOADED_SOURCE_VALUE);
    await setSourceFromFile(file);
    e.target.value = "";
  };

  const statusHint =
    skyDetect.status === "loading"
      ? "Loading model…"
      : skyDetect.status === "running"
        ? "Detecting sky…"
        : skyDetect.status === "error"
          ? "Detect error"
          : skyDetect.device
            ? skyDetect.device
            : null;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="fixed inset-x-0 top-0 z-40 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-sm md:static md:bg-background md:backdrop-blur-none">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to apps"
          tabIndex={0}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          Apps
        </Link>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
        <h1 className="shrink-0 text-sm font-medium text-foreground">V2 — Layers</h1>
        {statusHint ? (
          <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
            {statusHint}
            {filename && isUploaded ? ` · ${filename}` : null}
          </span>
        ) : null}
        <div className="ml-auto min-w-0">
          <AnimatedSegmentedControl
            value={state.view}
            onValueChange={setView}
            ariaLabel="Preview mode"
            listClassName="flex gap-1 rounded-lg border border-border p-0.5"
            options={VIEW_OPTIONS.map(({ id, label }) => ({
              id,
              label,
              ariaLabel: `${label} view`,
            }))}
          />
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <V2Preview
            compositeResult={compositeResult}
            labels={labels}
            view={state.view}
          />
        </div>

        <aside
          className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--mobile-panel-h)] flex-col overflow-hidden border-t border-border bg-background md:static md:h-auto md:w-[300px] md:border-t-0 md:border-l"
          aria-label="V2 controls"
        >
          <DialRoot mode="inline" theme="dark" productionEnabled />
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
        aria-label="Image file input"
        tabIndex={-1}
      />
    </div>
  );
};
