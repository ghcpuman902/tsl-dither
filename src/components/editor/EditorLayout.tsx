"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import { useProcessingWorkerContext } from "@/lib/processing-worker-context";
import type { DitherParams } from "@/lib/types";
import { PipelineNav } from "./PipelineNav";
import { PreviewCanvas } from "./PreviewCanvas";
import { DitherPreview } from "./DitherPreview";
import { LoadStage } from "./stages/LoadStage";
import { DownsizeStage } from "./stages/DownsizeStage";
import { ToneStage } from "./stages/ToneStage";
import { DitherStage } from "./stages/DitherStage";
import { ExportStage } from "./stages/ExportStage";
import { PipelineOutputFitCanvas } from "./PipelineOutputFitCanvas";

const PANEL_WIDTH = 288; // px, 18rem — expand freely later

const isValidHistogramSource = (img: ImageData): boolean =>
  img.width > 0 &&
  img.height > 0 &&
  img.data.length === img.width * img.height * 4;

const StagePanel = ({ sourceImageData }: { sourceImageData: ImageData | null }) => {
  const { state } = usePipeline();

  switch (state.activeStage) {
    case "load":
      return <LoadStage />;
    case "downsize":
      return (
        <DownsizeStage
          sourceWidth={sourceImageData?.width ?? 0}
          sourceHeight={sourceImageData?.height ?? 0}
        />
      );
    case "tone":
      return <ToneStage />;
    case "dither":
      return <DitherStage />;
    case "export":
      return <ExportStage />;
  }
};

export const EditorLayout = () => {
  const { state, setPipelineOutput, pipelineOutput } = usePipeline();
  const {
    requestDownsize,
    downsizeResult,
    requestTone,
    toneResult,
    requestHistogram,
    requestDither,
    ditherResult,
    setSource,
  } = useProcessingWorkerContext();
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);
  const downsizedImageData = useMemo(() => {
    if (!downsizeResult) return null;
    return new ImageData(
      new Uint8ClampedArray(downsizeResult.buffer.slice(0)),
      downsizeResult.width,
      downsizeResult.height
    );
  }, [downsizeResult]);

  const processedImageData = useMemo(() => {
    if (!toneResult) return null;
    return new ImageData(
      new Uint8ClampedArray(toneResult.buffer.slice(0)),
      toneResult.width,
      toneResult.height
    );
  }, [toneResult]);
  const downsizePreviewOutput = useMemo(() => {
    if (!downsizedImageData) return null;
    const { data, width, height } = downsizedImageData;
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return { buffer, width, height };
  }, [downsizedImageData]);
  const tonePreviewOutput = useMemo(() => {
    if (!processedImageData) return null;
    const { data, width, height } = processedImageData;
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return { buffer, width, height };
  }, [processedImageData]);

  const ditherInFlightRef = useRef(false);
  const pendingDitherRef = useRef<DitherParams | null>(null);
  const visitedDitherStageRef = useRef(false);
  const lastDitherSnapshotRef = useRef<{
    buffer: ArrayBuffer;
    width: number;
    height: number;
  } | null>(null);
  const prevSourceSrcRef = useRef<string | null>(null);

  const handleProcessed = useCallback((imageData: ImageData) => {
    setSourceImageData(imageData);
  }, []);

  useEffect(() => {
    if (!sourceImageData) return;
    requestDownsize(sourceImageData, state.downsize);
  }, [sourceImageData, state.downsize, requestDownsize]);

  useEffect(() => {
    if (!downsizedImageData) return;
    requestTone(downsizedImageData, state.tone, state.toneVisible);
  }, [downsizedImageData, state.tone, state.toneVisible, requestTone]);

  useEffect(() => {
    if (!processedImageData) return;
    setSource(processedImageData);
    if (isValidHistogramSource(processedImageData)) {
      requestHistogram(processedImageData);
    }
  }, [processedImageData, setSource, requestHistogram]);

  useEffect(() => {
    if (prevSourceSrcRef.current === null) {
      prevSourceSrcRef.current = state.sourceImageSrc;
      return;
    }
    if (prevSourceSrcRef.current !== state.sourceImageSrc) {
      prevSourceSrcRef.current = state.sourceImageSrc;
      visitedDitherStageRef.current = false;
      lastDitherSnapshotRef.current = null;
    }
  }, [state.sourceImageSrc]);

  useEffect(() => {
    if (state.activeStage === "dither") {
      visitedDitherStageRef.current = true;
    }
  }, [state.activeStage]);

  useEffect(() => {
    if (!ditherResult) return;
    const buffer = ditherResult.rgbBuffer.slice(0);
    lastDitherSnapshotRef.current = {
      buffer,
      width: ditherResult.width,
      height: ditherResult.height,
    };
  }, [ditherResult]);

  // Shared flattened output for Export: after visiting Dither, prefer last dither snapshot; else latest preview (load/tone).
  useEffect(() => {
    const snap = lastDitherSnapshotRef.current;
    if (
      visitedDitherStageRef.current &&
      snap &&
      snap.width > 0 &&
      snap.height > 0 &&
      snap.buffer.byteLength >= snap.width * snap.height * 4
    ) {
      setPipelineOutput({
        buffer: snap.buffer.slice(0),
        width: snap.width,
        height: snap.height,
      });
      return;
    }
    if (processedImageData && isValidHistogramSource(processedImageData)) {
      const { data, width, height } = processedImageData;
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      setPipelineOutput({ buffer, width, height });
      return;
    }
    setPipelineOutput(null);
  }, [
    processedImageData,
    ditherResult,
    setPipelineOutput,
    state.sourceImageSrc,
    state.activeStage,
  ]);

  useEffect(() => {
    if (state.activeStage !== "dither" || !processedImageData) {
      pendingDitherRef.current = null;
      return;
    }

    const dither = state.dither;
    if (!ditherInFlightRef.current) {
      ditherInFlightRef.current = true;
      pendingDitherRef.current = null;
      requestDither(dither);
      return;
    }

    pendingDitherRef.current = dither;
  }, [state.activeStage, state.dither, processedImageData, requestDither]);

  useEffect(() => {
    if (!ditherResult) return;
    ditherInFlightRef.current = false;

    if (state.activeStage !== "dither") {
      pendingDitherRef.current = null;
      return;
    }

    const pending = pendingDitherRef.current;
    if (!pending) return;

    pendingDitherRef.current = null;
    ditherInFlightRef.current = true;
    requestDither(pending);
  }, [ditherResult, state.activeStage, requestDither]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top pipeline navigation */}
      <PipelineNav />

      {/* Main area: preview (left) + panel (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: PreviewCanvas when not Dither; DitherPreview when Dither. Canvas stays mounted so processedImageData updates. */}
        <div className="relative flex-1 bg-black">
          <div
            className="h-full w-full"
            style={{
              visibility: state.activeStage === "load" ? "visible" : "hidden",
              position: state.activeStage === "load" ? "relative" : "absolute",
              inset: 0,
            }}
            aria-hidden={state.activeStage !== "load"}
          >
            <PreviewCanvas onProcessed={handleProcessed} />
          </div>
          {state.activeStage === "downsize" && (
            <div className="absolute inset-0">
              <PipelineOutputFitCanvas
                pipelineOutput={downsizePreviewOutput}
                aria-label="Downsize preview: resized pipeline frame"
              />
            </div>
          )}
          {state.activeStage === "tone" && (
            <div className="absolute inset-0">
              <PipelineOutputFitCanvas
                pipelineOutput={tonePreviewOutput}
                aria-label="Tone preview: downsized and tone-adjusted frame"
              />
            </div>
          )}
          {state.activeStage === "dither" && (
            <div className="absolute inset-0">
              <DitherPreview processedImageData={processedImageData} />
            </div>
          )}
          {state.activeStage === "export" && (
            <div className="absolute inset-0 z-10">
              <PipelineOutputFitCanvas
                pipelineOutput={pipelineOutput}
                aria-label="Export preview: current pipeline output"
              />
            </div>
          )}
        </div>

        {/* Right panel — fixed width, scrollable */}
        <aside
          className="flex flex-col overflow-y-auto border-l border-border bg-background"
          style={{ width: PANEL_WIDTH }}
          aria-label="Stage controls"
        >
          <StagePanel sourceImageData={sourceImageData} />
        </aside>
      </div>
    </div>
  );
};
