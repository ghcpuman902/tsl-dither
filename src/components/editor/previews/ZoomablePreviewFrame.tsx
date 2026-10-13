"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { usePinchZoomPan } from "@/lib/use-pinch-zoom-pan";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** When false, pan/pinch/double-tap are disabled (e.g. while painting). */
  gesturesEnabled?: boolean;
  /** Fires when a pinch/pan gesture starts or ends — used for deferred HQ redraw. */
  onInteractionChange?: (active: boolean) => void;
};

const DOUBLE_TAP_MS = 300;

export const ZoomablePreviewFrame = ({
  children,
  className,
  gesturesEnabled = true,
  onInteractionChange,
}: Props) => {
  const { bind, x, y, scale, reset } = usePinchZoomPan({ onInteractionChange });
  const lastTapRef = useRef(0);

  // Reset transform when entering paint mode so pointer→pixel mapping stays correct.
  useEffect(() => {
    if (!gesturesEnabled) reset();
  }, [gesturesEnabled, reset]);

  const handlePointerUp = () => {
    if (!gesturesEnabled) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) reset();
    lastTapRef.current = now;
  };

  const gestureBind = gesturesEnabled ? bind() : {};

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div
        {...gestureBind}
        onPointerUp={handlePointerUp}
        style={{ touchAction: gesturesEnabled ? "none" : "auto" }}
        className="absolute inset-x-0 top-[var(--mobile-nav-h)] bottom-[var(--mobile-panel-h)] md:inset-0"
      >
        <motion.div style={{ x, y, scale }} className="h-full w-full">
          {children}
        </motion.div>
      </div>
    </div>
  );
};
