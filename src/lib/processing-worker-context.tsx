"use client";

import React, { createContext, useContext } from "react";
import type {
  ProcessingWorkerActions,
  UseProcessingWorkerReturn,
} from "./use-processing-worker";
import { useProcessingWorker } from "./use-processing-worker";
import type { DitherResult, HistogramData } from "./worker-types";

type DownsizeResult = { buffer: ArrayBuffer; width: number; height: number } | null;
type ToneResult = { buffer: ArrayBuffer; width: number; height: number } | null;

type ProcessingWorkerResults = {
  downsizeResult: DownsizeResult;
  ditherResult: DitherResult | null;
  histogramResult: HistogramData | null;
  toneResult: ToneResult;
};

const ProcessingWorkerActionsContext = createContext<ProcessingWorkerActions | undefined>(undefined);
const DownsizeResultContext = createContext<DownsizeResult | undefined>(undefined);
const ToneResultContext = createContext<ToneResult | undefined>(undefined);
const DitherResultContext = createContext<DitherResult | null | undefined>(undefined);
const HistogramResultContext = createContext<HistogramData | null | undefined>(undefined);

export const ProcessingWorkerProvider = ({ children }: { children: React.ReactNode }) => {
  const worker = useProcessingWorker();

  const actions: ProcessingWorkerActions = {
    setSource: worker.setSource,
    requestDownsize: worker.requestDownsize,
    requestDither: worker.requestDither,
    requestHistogram: worker.requestHistogram,
    requestTone: worker.requestTone,
  };

  return (
    <ProcessingWorkerActionsContext.Provider value={actions}>
      <DownsizeResultContext.Provider value={worker.downsizeResult}>
        <ToneResultContext.Provider value={worker.toneResult}>
          <DitherResultContext.Provider value={worker.ditherResult}>
            <HistogramResultContext.Provider value={worker.histogramResult}>
              {children}
            </HistogramResultContext.Provider>
          </DitherResultContext.Provider>
        </ToneResultContext.Provider>
      </DownsizeResultContext.Provider>
    </ProcessingWorkerActionsContext.Provider>
  );
};

export const useProcessingWorkerActions = (): ProcessingWorkerActions => {
  const ctx = useContext(ProcessingWorkerActionsContext);
  if (!ctx) {
    throw new Error("useProcessingWorkerActions must be used within ProcessingWorkerProvider");
  }
  return ctx;
};

export const useDownsizeResult = (): DownsizeResult => {
  const ctx = useContext(DownsizeResultContext);
  if (ctx === undefined) {
    throw new Error("useDownsizeResult must be used within ProcessingWorkerProvider");
  }
  return ctx;
};

export const useToneResult = (): ToneResult => {
  const ctx = useContext(ToneResultContext);
  if (ctx === undefined) {
    throw new Error("useToneResult must be used within ProcessingWorkerProvider");
  }
  return ctx;
};

export const useDitherResult = (): DitherResult | null => {
  const ctx = useContext(DitherResultContext);
  if (ctx === undefined) {
    throw new Error("useDitherResult must be used within ProcessingWorkerProvider");
  }
  return ctx;
};

export const useHistogramResult = (): HistogramData | null => {
  const ctx = useContext(HistogramResultContext);
  if (ctx === undefined) {
    throw new Error("useHistogramResult must be used within ProcessingWorkerProvider");
  }
  return ctx;
};

/** @deprecated Prefer focused hooks (useToneResult, useProcessingWorkerActions, etc.) */
export const useProcessingWorkerContext = (): UseProcessingWorkerReturn => {
  const actions = useProcessingWorkerActions();
  return {
    ...actions,
    downsizeResult: useDownsizeResult(),
    toneResult: useToneResult(),
    ditherResult: useDitherResult(),
    histogramResult: useHistogramResult(),
  };
};
