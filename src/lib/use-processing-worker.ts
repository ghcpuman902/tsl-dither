"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DitherParams, ToneParams, ToneVisible } from "./types";
import type { DitherResult, HistogramData, WorkerRequest, WorkerResponse } from "./worker-types";

const DEBUG = process.env.NODE_ENV === "development";

export type ProcessingWorkerState = {
  ditherResult: DitherResult | null;
  histogramResult: HistogramData | null;
  toneResult: { buffer: ArrayBuffer; width: number; height: number } | null;
};

export type ProcessingWorkerActions = {
  setSource: (imageData: ImageData) => void;
  requestDither: (params: DitherParams) => void;
  requestHistogram: (imageData: ImageData) => void;
  requestTone: (
    imageData: ImageData,
    params: ToneParams,
    visible: ToneVisible
  ) => void;
};

export type UseProcessingWorkerReturn = ProcessingWorkerState & ProcessingWorkerActions;

export const useProcessingWorker = (): UseProcessingWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const ditherIdRef = useRef(0);
  const histogramIdRef = useRef(0);
  const toneIdRef = useRef(0);
  const pendingDitherTimeRef = useRef(0);
  const pendingHistogramTimeRef = useRef(0);
  const pendingToneTimeRef = useRef(0);

  const [ditherResult, setDitherResult] = useState<DitherResult | null>(null);
  const [histogramResult, setHistogramResult] = useState<HistogramData | null>(null);
  const [toneResult, setToneResult] = useState<{
    buffer: ArrayBuffer;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("./processing.worker.ts", import.meta.url),
      { type: "module" }
    );

    const handleMessage = (e: MessageEvent<WorkerResponse>): void => {
      const msg = e.data;

      switch (msg.type) {
        case "dither-result": {
          if (msg.id !== ditherIdRef.current) return;
          if (DEBUG && pendingDitherTimeRef.current) {
            const ms = (performance.now() - pendingDitherTimeRef.current).toFixed(0);
            console.log(`[Worker] dither result #${msg.id} received (${ms}ms)`);
            pendingDitherTimeRef.current = 0;
          }
          setDitherResult({
            width: msg.width,
            height: msg.height,
            rgbBuffer: msg.rgbBuffer,
            rBuffer: msg.rBuffer,
            gBuffer: msg.gBuffer,
            bBuffer: msg.bBuffer,
          });
          break;
        }
        case "histogram-result": {
          if (msg.id !== histogramIdRef.current) return;
          if (DEBUG && pendingHistogramTimeRef.current) {
            const ms = (performance.now() - pendingHistogramTimeRef.current).toFixed(0);
            console.log(`[Worker] histogram result #${msg.id} received (${ms}ms)`);
            pendingHistogramTimeRef.current = 0;
          }
          setHistogramResult({ r: msg.r, g: msg.g, b: msg.b });
          break;
        }
        case "tone-result": {
          if (msg.id !== toneIdRef.current) return;
          if (DEBUG && pendingToneTimeRef.current) {
            const ms = (performance.now() - pendingToneTimeRef.current).toFixed(0);
            console.log(`[Worker] tone result #${msg.id} received (${ms}ms)`);
            pendingToneTimeRef.current = 0;
          }
          setToneResult({
            buffer: msg.buffer,
            width: msg.width,
            height: msg.height,
          });
          break;
        }
      }
    };

    worker.addEventListener("message", handleMessage);
    workerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const setSource = useCallback((imageData: ImageData) => {
    const id = Math.max(ditherIdRef.current, histogramIdRef.current, toneIdRef.current) + 1;
    const buffer = imageData.data.buffer.slice(
      imageData.data.byteOffset,
      imageData.data.byteOffset + imageData.data.byteLength
    );
    const req: WorkerRequest = {
      type: "set-source",
      id,
      buffer,
      width: imageData.width,
      height: imageData.height,
    };
    workerRef.current?.postMessage(req);
    if (DEBUG) console.log("[Worker] set-source sent");
  }, []);

  const requestDither = useCallback((params: DitherParams) => {
    const id = ++ditherIdRef.current;
    if (DEBUG) {
      pendingDitherTimeRef.current = performance.now();
      console.log(`[Worker] dither request #${id} sent`);
    }
    const req: WorkerRequest = { type: "dither", id, params };
    workerRef.current?.postMessage(req);
  }, []);

  const requestHistogram = useCallback((imageData: ImageData) => {
    const id = ++histogramIdRef.current;
    const buffer = imageData.data.buffer.slice(
      imageData.data.byteOffset,
      imageData.data.byteOffset + imageData.data.byteLength
    );
    if (DEBUG) {
      pendingHistogramTimeRef.current = performance.now();
      console.log(`[Worker] histogram request #${id} sent`);
    }
    const req: WorkerRequest = {
      type: "histogram",
      id,
      buffer,
      width: imageData.width,
      height: imageData.height,
    };
    workerRef.current?.postMessage(req);
  }, []);

  const requestTone = useCallback(
    (imageData: ImageData, params: ToneParams, visible: ToneVisible) => {
      const id = ++toneIdRef.current;
      const buffer = imageData.data.buffer.slice(
        imageData.data.byteOffset,
        imageData.data.byteOffset + imageData.data.byteLength
      );
      if (DEBUG) {
        pendingToneTimeRef.current = performance.now();
        console.log(`[Worker] tone request #${id} sent`);
      }
      const req: WorkerRequest = {
        type: "tone",
        id,
        buffer,
        width: imageData.width,
        height: imageData.height,
        params,
        visible,
      };
      workerRef.current?.postMessage(req);
    },
    []
  );

  return {
    ditherResult,
    histogramResult,
    toneResult,
    setSource,
    requestDither,
    requestHistogram,
    requestTone,
  };
};
