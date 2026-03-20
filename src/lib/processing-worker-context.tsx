"use client";

import React, { createContext, useContext } from "react";
import type { UseProcessingWorkerReturn } from "./use-processing-worker";
import { useProcessingWorker } from "./use-processing-worker";

const ProcessingWorkerContext = createContext<UseProcessingWorkerReturn | null>(null);

export const ProcessingWorkerProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useProcessingWorker();
  return (
    <ProcessingWorkerContext.Provider value={value}>
      {children}
    </ProcessingWorkerContext.Provider>
  );
};

export const useProcessingWorkerContext = (): UseProcessingWorkerReturn => {
  const ctx = useContext(ProcessingWorkerContext);
  if (!ctx) throw new Error("useProcessingWorkerContext must be used within ProcessingWorkerProvider");
  return ctx;
};
