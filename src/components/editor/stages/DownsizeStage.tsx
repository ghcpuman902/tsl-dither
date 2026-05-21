"use client";

import { useMemo, type ChangeEvent } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import type { DownsizeAlgorithm, DownsizeRatioDivisor } from "@/lib/types";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  sourceWidth: number;
  sourceHeight: number;
};

const RATIO_OPTIONS: DownsizeRatioDivisor[] = [1, 2, 4, 8, 16, 32];

const ALGORITHM_OPTIONS: {
  id: DownsizeAlgorithm;
  label: string;
  description: string;
  wikipediaUrl: string;
}[] = [
  {
    id: "nearest",
    label: "Nearest",
    description:
      "Picks the closest source pixel—fast and crisp, but can look blocky when shrinking.",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Nearest-neighbor_interpolation",
  },
  {
    id: "bilinear",
    label: "Bilinear",
    description:
      "Averages the four nearest pixels for a smooth, slightly soft downscale.",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bilinear_interpolation",
  },
  {
    id: "bicubic",
    label: "Bicubic",
    description:
      "Uses a 4×4 neighborhood for sharper, smoother results than bilinear.",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Bicubic_interpolation",
  },
  {
    id: "lanczos",
    label: "Lanczos",
    description:
      "Windowed sinc filter that preserves fine detail well when scaling down.",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Lanczos_resampling",
  },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const DownsizeStage = ({ sourceWidth, sourceHeight }: Props) => {
  const { state, updateDownsize } = usePipeline();
  const { downsize } = state;

  const selectedAlgorithm =
    ALGORITHM_OPTIONS.find((option) => option.id === downsize.algorithm) ??
    ALGORITHM_OPTIONS[0];

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
        <AnimatedSegmentedControl
          value={downsize.mode}
          onValueChange={(mode) => updateDownsize({ mode })}
          ariaLabel="Downsize mode"
          options={[
            { id: "ratio", label: "Ratio", ariaLabel: "Use Ratio mode" },
            {
              id: "target-width",
              label: "Target width",
              ariaLabel: "Use Target width mode",
            },
          ]}
        />
      </div>

      {downsize.mode === "ratio" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Downsize ratio</span>
          <AnimatedSegmentedControl
            value={String(downsize.ratioDivisor)}
            onValueChange={(id) =>
              updateDownsize({
                ratioDivisor: Number(id) as DownsizeRatioDivisor,
              })
            }
            ariaLabel="Downsize ratio selector"
            listClassName="flex flex-wrap gap-1 rounded-lg border border-border p-1"
            itemClassName="min-w-12"
            options={RATIO_OPTIONS.map((divisor) => ({
              id: String(divisor),
              label: `1/${divisor}`,
              ariaLabel: `Downsize to one over ${divisor}`,
            }))}
          />
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
        <AnimatedSegmentedControl
          value={downsize.algorithm}
          onValueChange={(algorithm) => updateDownsize({ algorithm })}
          ariaLabel="Resize algorithm"
          listClassName="flex flex-wrap gap-1 rounded-lg border border-border p-1"
          options={ALGORITHM_OPTIONS.map(({ id, label }) => ({
            id,
            label,
            ariaLabel: `${label} resize algorithm`,
          }))}
        />
        <p className="text-xs text-muted-foreground" role="note" aria-live="polite">
          {selectedAlgorithm.description}{" "}
          <a
            href={selectedAlgorithm.wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-primary"
          >
            Wikipedia
          </a>
        </p>
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
