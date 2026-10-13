"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useMotionValue, animate } from "motion/react";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOMED_IN_THRESHOLD = 1.02;
const ZOOM_RESET_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

type Options = {
  /** Fires when a pinch/pan gesture starts or ends. */
  onInteractionChange?: (active: boolean) => void;
};

export const usePinchZoomPan = (options: Options = {}) => {
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const activeCountRef = useRef(0);
  const onInteractionChangeRef = useRef(options.onInteractionChange);

  useEffect(() => {
    onInteractionChangeRef.current = options.onInteractionChange;
  }, [options.onInteractionChange]);

  const bumpInteraction = useCallback((delta: 1 | -1) => {
    const prev = activeCountRef.current;
    activeCountRef.current = Math.max(0, prev + delta);
    const nextActive = activeCountRef.current > 0;
    if ((prev > 0) !== nextActive) {
      onInteractionChangeRef.current?.(nextActive);
    }
  }, []);

  const reset = useCallback(() => {
    animate(scale, 1, ZOOM_RESET_SPRING);
    animate(x, 0, ZOOM_RESET_SPRING);
    animate(y, 0, ZOOM_RESET_SPRING);
    setIsZoomedIn(false);
    if (activeCountRef.current > 0) {
      activeCountRef.current = 0;
      onInteractionChangeRef.current?.(false);
    }
  }, [scale, x, y]);

  const bind = useGesture(
    {
      onPinch: ({ offset: [s], first, last }) => {
        if (first) bumpInteraction(1);
        scale.set(s);
        setIsZoomedIn(s > ZOOMED_IN_THRESHOLD);
        if (last) bumpInteraction(-1);
      },
      onDrag: ({ offset: [dx, dy], pinching, first, last }) => {
        if (pinching || scale.get() <= 1) return;
        if (first) bumpInteraction(1);
        x.set(dx);
        y.set(dy);
        if (last) bumpInteraction(-1);
      },
    },
    {
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, rubberband: true },
      drag: { from: () => [x.get(), y.get()] },
    },
  );

  return { bind, x, y, scale, isZoomedIn, reset };
};
