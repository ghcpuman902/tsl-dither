"use client";

import { cn } from "@/lib/utils";

const BAYER_SIZES = [2, 4, 8] as const;

type BayerControlsProps = {
  bayerSize: number;
  onBayerSizeChange: (size: (typeof BAYER_SIZES)[number]) => void;
};

export const BayerControls = ({ bayerSize, onBayerSizeChange }: BayerControlsProps) => {
  const normalizedBayerSize: (typeof BAYER_SIZES)[number] =
    bayerSize <= 2 ? 2 : bayerSize <= 4 ? 4 : 8;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Matrix size</span>
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-border p-1"
        role="tablist"
        aria-label="Bayer matrix size"
      >
        {BAYER_SIZES.map((size) => {
          const selected = normalizedBayerSize === size;
          return (
            <button
              key={size}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`Bayer ${size} by ${size} matrix`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onBayerSizeChange(size)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBayerSizeChange(size);
                }
              }}
              className={cn(
                "min-w-12 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {size}×{size}
            </button>
          );
        })}
      </div>
    </div>
  );
};
