"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SkyDetectDevice } from "@/lib/sky/sky-detector";
import type { SkyWorkerResponse } from "./v2-sky.worker";

export type SkyDetectStatus =
  | "idle"
  | "loading"
  | "running"
  | "ready"
  | "error";

export type SkyDetectState = {
  status: SkyDetectStatus;
  device: SkyDetectDevice | null;
  error: string | null;
};

export type SkyDetectResult = {
  skyMargin: Float32Array;
  classMap: Uint16Array;
  width: number;
  height: number;
  inferWidth: number;
  inferHeight: number;
  logitWidth: number;
  logitHeight: number;
  inferenceMs: number;
  device: SkyDetectDevice;
};

const DEBUG = process.env.NODE_ENV === "development";

export type UseV2SkyDetectReturn = {
  state: SkyDetectState;
  requestDetect: (
    imageData: ImageData,
    options?: { maxLongEdge?: number },
  ) => Promise<SkyDetectResult>;
  warmup: () => void;
};

export const useV2SkyDetect = (): UseV2SkyDetectReturn => {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef<{
    id: number;
    resolve: (result: SkyDetectResult) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const [state, setState] = useState<SkyDetectState>({
    status: "idle",
    device: null,
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(new URL("./v2-sky.worker.ts", import.meta.url), {
      type: "module",
    });

    const handleMessage = (e: MessageEvent<SkyWorkerResponse>): void => {
      const msg = e.data;

      if (msg.type === "ready") {
        setState((prev) => ({
          ...prev,
          status: "ready",
          device: msg.device,
          error: null,
        }));
        return;
      }

      if (msg.type === "detect-result") {
        const pending = pendingRef.current;
        if (!pending || pending.id !== msg.id) return;
        pendingRef.current = null;
        const skyMargin = new Float32Array(msg.skyMarginBuffer);
        const classMap = new Uint16Array(msg.classMapBuffer);
        if (DEBUG) {
          console.log(
            `[V2 Sky] result #${msg.id} ${msg.width}x${msg.height} ${msg.inferenceMs.toFixed(0)}ms ${msg.device}`,
          );
        }
        setState((prev) => ({
          ...prev,
          status: "ready",
          device: msg.device,
          error: null,
        }));
        pending.resolve({
          skyMargin,
          classMap,
          width: msg.width,
          height: msg.height,
          inferWidth: msg.inferWidth,
          inferHeight: msg.inferHeight,
          logitWidth: msg.logitWidth,
          logitHeight: msg.logitHeight,
          inferenceMs: msg.inferenceMs,
          device: msg.device,
        });
        return;
      }

      if (msg.type === "error") {
        const pending = pendingRef.current;
        if (pending && (msg.id === undefined || pending.id === msg.id)) {
          pendingRef.current = null;
          pending.reject(new Error(msg.message));
        }
        setState((prev) => ({
          ...prev,
          status: "error",
          error: msg.message,
        }));
      }
    };

    worker.addEventListener("message", handleMessage);
    workerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
      if (pendingRef.current) {
        pendingRef.current.reject(new Error("Sky detect worker terminated"));
        pendingRef.current = null;
      }
    };
  }, []);

  const warmup = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    setState((prev) =>
      prev.status === "idle" || prev.status === "error"
        ? { ...prev, status: "loading", error: null }
        : prev,
    );
    worker.postMessage({ type: "warmup" });
  }, []);

  const requestDetect = useCallback(
    (
      imageData: ImageData,
      options?: { maxLongEdge?: number },
    ): Promise<SkyDetectResult> => {
      const worker = workerRef.current;
      if (!worker) {
        return Promise.reject(new Error("Sky detect worker not ready"));
      }

      if (pendingRef.current) {
        pendingRef.current.reject(new Error("Superseded by newer detect request"));
        pendingRef.current = null;
      }

      const id = ++requestIdRef.current;
      const buffer = imageData.data.buffer.slice(
        imageData.data.byteOffset,
        imageData.data.byteOffset + imageData.data.byteLength,
      ) as ArrayBuffer;

      setState((prev) => ({
        ...prev,
        status: "running",
        error: null,
      }));

      if (DEBUG) {
        console.log(
          `[V2 Sky] request #${id} sent ${imageData.width}x${imageData.height}` +
            (options?.maxLongEdge ? ` maskEdge=${options.maxLongEdge}` : ""),
        );
      }

      return new Promise<SkyDetectResult>((resolve, reject) => {
        pendingRef.current = { id, resolve, reject };
        worker.postMessage({
          type: "detect",
          id,
          buffer,
          width: imageData.width,
          height: imageData.height,
          maxLongEdge: options?.maxLongEdge,
        });
      });
    },
    [],
  );

  return { state, requestDetect, warmup };
};
