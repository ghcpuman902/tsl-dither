"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PaletteDitherParams } from "./types";
import type { V3LayerId } from "./layers";
import type {
  V3CompositeResult,
  V3WorkerRequest,
  V3WorkerResponse,
} from "./worker-types";

const DEBUG = process.env.NODE_ENV === "development";

export type UseV3WorkerReturn = {
  compositeResult: V3CompositeResult | null;
  requestComposite: (
    imageData: ImageData,
    labels: Uint8Array,
    layerParams: Record<V3LayerId, PaletteDitherParams>,
  ) => void;
};

export const useV3Worker = (): UseV3WorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const compositeIdRef = useRef(0);
  const pendingTimeRef = useRef(0);
  const [compositeResult, setCompositeResult] =
    useState<V3CompositeResult | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./v3.worker.ts", import.meta.url), {
      type: "module",
    });

    const handleMessage = (e: MessageEvent<V3WorkerResponse>): void => {
      const msg = e.data;
      if (msg.type !== "composite-result") return;
      if (msg.id !== compositeIdRef.current) return;
      if (DEBUG && pendingTimeRef.current) {
        const ms = (performance.now() - pendingTimeRef.current).toFixed(0);
        console.log(`[V3 Worker] composite result #${msg.id} received (${ms}ms)`);
        pendingTimeRef.current = 0;
      }
      setCompositeResult({
        buffer: msg.buffer,
        width: msg.width,
        height: msg.height,
      });
    };

    worker.addEventListener("message", handleMessage);
    workerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestComposite = useCallback(
    (
      imageData: ImageData,
      labels: Uint8Array,
      layerParams: Record<V3LayerId, PaletteDitherParams>,
    ) => {
      const worker = workerRef.current;
      if (!worker) return;

      const id = ++compositeIdRef.current;
      const buffer = imageData.data.buffer.slice(
        imageData.data.byteOffset,
        imageData.data.byteOffset + imageData.data.byteLength,
      ) as ArrayBuffer;
      const labelsCopy = new Uint8Array(labels.byteLength);
      labelsCopy.set(labels);
      const labelsBuffer = labelsCopy.buffer;

      const msg: V3WorkerRequest = {
        type: "composite",
        id,
        buffer,
        labelsBuffer,
        width: imageData.width,
        height: imageData.height,
        layerParams,
      };

      if (DEBUG) {
        pendingTimeRef.current = performance.now();
        console.log(`[V3 Worker] composite request #${id} sent`);
      }

      worker.postMessage(msg);
    },
    [],
  );

  return { compositeResult, requestComposite };
};
