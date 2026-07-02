"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import type { ProcessingWorkerActions } from "./use-processing-worker";
import type { DitherParams, PipelineOutput, PipelineState, ToneVisible } from "./types";

const PIPELINE_DEBOUNCE_MS = 175;

const isValidHistogramSource = (img: ImageData): boolean =>
  img.width > 0 &&
  img.height > 0 &&
  img.data.length === img.width * img.height * 4;

type UsePipelineCoordinatorArgs = {
  sourceImageData: ImageData | null;
  state: PipelineState;
  setPipelineOutput: (output: PipelineOutput | null) => void;
  workerActions: ProcessingWorkerActions;
  downsizeResult: { buffer: ArrayBuffer; width: number; height: number } | null;
  toneResult: { buffer: ArrayBuffer; width: number; height: number } | null;
  ditherResult: {
    width: number;
    height: number;
    rgbBuffer: ArrayBuffer;
  } | null;
};

export type UsePipelineCoordinatorReturn = {
  downsizedImageData: ImageData | null;
  processedImageData: ImageData | null;
  downsizePreviewOutput: PipelineOutput | null;
  tonePreviewOutput: PipelineOutput | null;
};

export const usePipelineCoordinator = ({
  sourceImageData,
  state,
  setPipelineOutput,
  workerActions,
  downsizeResult,
  toneResult,
  ditherResult,
}: UsePipelineCoordinatorArgs): UsePipelineCoordinatorReturn => {
  const { requestDownsize, requestTone, requestHistogram, requestDither, setSource } =
    workerActions;

  const deferredDownsize = useDeferredValue(state.downsize);
  const deferredTone = useDeferredValue(state.tone);
  const deferredToneVisible = useDeferredValue(state.toneVisible) as ToneVisible;
  const deferredDither = useDeferredValue(state.dither);

  const ditherInFlightRef = useRef(false);
  const pendingDitherRef = useRef<DitherParams | null>(null);
  const visitedDitherStageRef = useRef(false);
  const lastDitherSnapshotRef = useRef<{
    buffer: ArrayBuffer;
    width: number;
    height: number;
  } | null>(null);
  const prevSourceSrcRef = useRef<string | null>(null);
  const downsizeTimerRef = useRef(0);
  const toneTimerRef = useRef(0);

  const downsizedImageData = useMemo(() => {
    if (!downsizeResult) return null;
    return new ImageData(
      new Uint8ClampedArray(downsizeResult.buffer.slice(0)),
      downsizeResult.width,
      downsizeResult.height,
    );
  }, [downsizeResult]);

  const processedImageData = useMemo(() => {
    if (!toneResult) return null;
    return new ImageData(
      new Uint8ClampedArray(toneResult.buffer.slice(0)),
      toneResult.width,
      toneResult.height,
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

  useEffect(() => {
    if (!sourceImageData) return;
    window.clearTimeout(downsizeTimerRef.current);
    downsizeTimerRef.current = window.setTimeout(() => {
      requestDownsize(sourceImageData, deferredDownsize);
    }, PIPELINE_DEBOUNCE_MS);
    return () => window.clearTimeout(downsizeTimerRef.current);
  }, [sourceImageData, deferredDownsize, requestDownsize]);

  useEffect(() => {
    if (!downsizedImageData) return;
    window.clearTimeout(toneTimerRef.current);
    toneTimerRef.current = window.setTimeout(() => {
      requestTone(downsizedImageData, deferredTone, deferredToneVisible);
    }, PIPELINE_DEBOUNCE_MS);
    return () => window.clearTimeout(toneTimerRef.current);
  }, [downsizedImageData, deferredTone, deferredToneVisible, requestTone]);

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
    if (state.activeStage === "dither" || state.activeStage === "export") {
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

  const needsDither =
    state.activeStage === "dither" || state.activeStage === "export";

  useEffect(() => {
    if (!needsDither || !processedImageData) {
      pendingDitherRef.current = null;
      return;
    }

    const dither = deferredDither;
    if (!ditherInFlightRef.current) {
      ditherInFlightRef.current = true;
      pendingDitherRef.current = null;
      requestDither(dither);
      return;
    }

    pendingDitherRef.current = dither;
  }, [needsDither, deferredDither, processedImageData, requestDither]);

  useEffect(() => {
    if (!ditherResult) return;
    ditherInFlightRef.current = false;

    if (!needsDither) {
      pendingDitherRef.current = null;
      return;
    }

    const pending = pendingDitherRef.current;
    if (!pending) return;

    pendingDitherRef.current = null;
    ditherInFlightRef.current = true;
    requestDither(pending);
  }, [ditherResult, needsDither, requestDither]);

  return {
    downsizedImageData,
    processedImageData,
    downsizePreviewOutput,
    tonePreviewOutput,
  };
};
