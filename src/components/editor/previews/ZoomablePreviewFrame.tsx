"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { usePinchZoomPan } from "@/lib/use-pinch-zoom-pan";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

const DOUBLE_TAP_MS = 300;

export const ZoomablePreviewFrame = ({ children, className }: Props) => {
  const { bind, x, y, scale, reset } = usePinchZoomPan();
  const lastTapRef = useRef(0);

  const handlePointerUp = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) reset();
    lastTapRef.current = now;
  };

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div
        {...bind()}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
        className="absolute inset-x-0 top-[var(--mobile-nav-h)] bottom-[var(--mobile-panel-h)] md:inset-0"
      >
        <motion.div style={{ x, y, scale }} className="h-full w-full">
          {children}
        </motion.div>
      </div>
    </div>
  );
};
