"use client";

import { useCallback, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useMotionValue, animate } from "motion/react";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOMED_IN_THRESHOLD = 1.02;
const ZOOM_RESET_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

export const usePinchZoomPan = () => {
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isZoomedIn, setIsZoomedIn] = useState(false);

  const reset = useCallback(() => {
    animate(scale, 1, ZOOM_RESET_SPRING);
    animate(x, 0, ZOOM_RESET_SPRING);
    animate(y, 0, ZOOM_RESET_SPRING);
    setIsZoomedIn(false);
  }, [scale, x, y]);

  const bind = useGesture(
    {
      onPinch: ({ offset: [s] }) => {
        scale.set(s);
        setIsZoomedIn(s > ZOOMED_IN_THRESHOLD);
      },
      onDrag: ({ offset: [dx, dy], pinching }) => {
        if (pinching || scale.get() <= 1) return;
        x.set(dx);
        y.set(dy);
      },
    },
    {
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, rubberband: true },
      drag: { from: () => [x.get(), y.get()] },
    },
  );

  return { bind, x, y, scale, isZoomedIn, reset };
};
