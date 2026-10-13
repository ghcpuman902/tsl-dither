"use client";

import { useEffect, useRef } from "react";
import type { PaletteDitherParams } from "./types";
import type { V3LayerId } from "./layers";
import { useV3Worker } from "./use-v3-worker";
import type { V3CompositeResult } from "./worker-types";

const DEBOUNCE_MS = 175;

export type UseV3CoordinatorReturn = {
  compositeResult: V3CompositeResult | null;
};

export const useV3Coordinator = (
  workingImageData: ImageData | null,
  labels: Uint8Array | null,
  layerParams: Record<V3LayerId, PaletteDitherParams>,
): UseV3CoordinatorReturn => {
  const { compositeResult, requestComposite } = useV3Worker();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!workingImageData || !labels) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      requestComposite(workingImageData, labels, layerParams);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workingImageData, labels, layerParams, requestComposite]);

  return { compositeResult };
};
