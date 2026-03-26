"use client";

import { useMemo, type ChangeEvent, type KeyboardEvent } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import type { DownsizeAlgorithm, DownsizeRatioDivisor } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  sourceWidth: number;
  sourceHeight: number;
};

const RATIO_OPTIONS: DownsizeRatioDivisor[] = [1, 2, 4, 8, 16, 32];

const ALGORITHM_OPTIONS: { id: DownsizeAlgorithm; label: string }[] = [
  { id: "nearest", label: "Nearest" },
  { id: "bilinear", label: "Bilinear" },
  { id: "bicubic", label: "Bicubic" },
  { id: "lanczos", label: "Lanczos" },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const DownsizeStage = ({ sourceWidth, sourceHeight }: Props) => {
  const { state, updateDownsize } = usePipeline();
  const { downsize } = state;

  const nextSize = useMemo(() => {
    if (sourceWidth <= 0 || sourceHeight <= 0) return { width: 0, height: 0 };
    if (downsize.mode === "target-width") {
      const width = clamp(Math.round(downsize.targetWidthPx), 1, sourceWidth);
      const height = clamp(Math.round((sourceHeight * width) / sourceWidth), 1, sourceHeight);
      return { width, height };
    }
    const width = clamp(Math.round(sourceWidth / downsize.ratioDivisor), 1, sourceWidth);
    const height = clamp(Math.round(sourceHeight / downsize.ratioDivisor), 1, sourceHeight);
    return { width, height };
  }, [downsize.mode, downsize.ratioDivisor, downsize.targetWidthPx, sourceWidth, sourceHeight]);

  const handleModeClick = (mode: "ratio" | "target-width") => {
    updateDownsize({ mode });
  };

  const handleModeKeyDown = (event: KeyboardEvent, mode: "ratio" | "target-width") => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleModeClick(mode);
  };

  const handleTargetWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(parsed)) {
      updateDownsize({ targetWidthPx: sourceWidth > 0 ? sourceWidth : 1 });
      return;
    }
    updateDownsize({ targetWidthPx: clamp(parsed, 1, Math.max(1, sourceWidth)) });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Resize mode</span>
        <div
          className="flex w-fit flex-wrap gap-1 rounded-lg border border-border p-1"
          role="tablist"
          aria-label="Downsize mode"
        >
          {([
            { id: "ratio", label: "Ratio" },
            { id: "target-width", label: "Target width" },
          ] as const).map(({ id, label }) => {
            const selected = downsize.mode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={`Use ${label} mode`}
                onClick={() => handleModeClick(id)}
                onKeyDown={(event) => handleModeKeyDown(event, id)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {downsize.mode === "ratio" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Downsize ratio</span>
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-border p-1"
            role="tablist"
            aria-label="Downsize ratio selector"
          >
            {RATIO_OPTIONS.map((divisor) => {
              const selected = downsize.ratioDivisor === divisor;
              return (
                <button
                  key={divisor}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  aria-label={`Downsize to one over ${divisor}`}
                  onClick={() => updateDownsize({ ratioDivisor: divisor })}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    updateDownsize({ ratioDivisor: divisor });
                  }}
                  className={cn(
                    "min-w-12 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  1/{divisor}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {downsize.mode === "target-width" && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium" htmlFor="target-width-px">
            Target width
          </Label>
          <Input
            id="target-width-px"
            type="number"
            min={1}
            max={Math.max(1, sourceWidth)}
            step={1}
            value={downsize.targetWidthPx}
            onChange={handleTargetWidthChange}
            aria-label="Target width in pixels"
          />
          <span className="text-xs text-muted-foreground">
            Width is clamped to source width ({sourceWidth || 0}px).
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Algorithm</span>
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-border p-1"
          role="tablist"
          aria-label="Resize algorithm"
        >
          {ALGORITHM_OPTIONS.map(({ id, label }) => {
            const selected = downsize.algorithm === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={`${label} resize algorithm`}
                onClick={() => updateDownsize({ algorithm: id })}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  updateDownsize({ algorithm: id });
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Output size</span>
        <span className="text-sm">
          {nextSize.width} x {nextSize.height}px
        </span>
      </div>
    </div>
  );
};
