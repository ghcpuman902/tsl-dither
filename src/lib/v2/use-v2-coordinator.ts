"use client";

import { useEffect, useRef } from "react";
import type { DitherParams } from "@/lib/types";
import type { V2LayerId } from "./layers";
import { useV2Worker } from "./use-v2-worker";
import type { V2CompositeResult } from "./worker-types";

const DEBOUNCE_MS = 175;

export type UseV2CoordinatorReturn = {
  compositeResult: V2CompositeResult | null;
};

/**
 * Debounces composite on load / label / recipe changes.
 */
export const useV2Coordinator = (
  workingImageData: ImageData | null,
  labels: Uint8Array | null,
  layerParams: Record<V2LayerId, DitherParams>,
): UseV2CoordinatorReturn => {
  const { compositeResult, requestComposite } = useV2Worker();
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
