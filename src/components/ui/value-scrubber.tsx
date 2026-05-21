"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SCRUB_PIXELS_PER_STEP = 4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundToStep = (value: number, step: number): number => {
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
};

type ValueScrubberProps = {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  resetValue?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export const ValueScrubber = ({
  value,
  onValueChange,
  min,
  max,
  step,
  resetValue = 0,
  formatValue = (v) => String(v),
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: ValueScrubberProps) => {
  const scrubStartRef = React.useRef<{ x: number; value: number } | null>(null);

  const applyScrubDelta = (clientX: number, shiftKey: boolean) => {
    const start = scrubStartRef.current;
    if (!start) return;

    const fineMult = shiftKey ? 0.1 : 1;
    const delta =
      ((clientX - start.x) / SCRUB_PIXELS_PER_STEP) * step * fineMult;
    const next = clamp(roundToStep(start.value + delta, step), min, max);
    onValueChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubStartRef.current = { x: e.clientX, value };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrubStartRef.current) return;
    applyScrubDelta(e.clientX, e.shiftKey);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrubStartRef.current) return;
    scrubStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    onValueChange(resetValue);
  };

  return (
    <span
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      title="Drag to adjust · double-click to reset"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "shrink-0 select-none tabular-nums text-xs text-muted-foreground",
        !disabled && "cursor-ew-resize hover:text-foreground",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      {formatValue(value)}
    </span>
  );
};
