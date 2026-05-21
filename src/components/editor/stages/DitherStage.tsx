"use client";

import { usePipeline } from "@/lib/pipeline-context";
import type { DitherMethod } from "@/lib/types";
import { DEFAULT_DITHER_PARAMS } from "@/lib/types";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { ParamSlider } from "@/components/ui/param-slider";
import { cn } from "@/lib/utils";

const DITHER_METHODS: { id: DitherMethod; label: string }[] = [
  { id: "threshold", label: "Threshold" },
  { id: "white-noise", label: "White noise" },
  { id: "bayer", label: "Bayer" },
];

const BAYER_SIZES = [2, 4, 8] as const;

const INTROS: Record<DitherMethod, string> = {
  threshold:
    "Binary cutoff per channel: each R, G, B is 255 if at or above the threshold, else 0. Combined they give up to 8 colors.",
  "white-noise":
    "Randomized binary per channel: the cutoff is perturbed by noise so the result is grainier. Density controls how strong the noise is.",
  bayer:
    "Ordered dither using a Bayer threshold matrix (2×2, 4×4, or 8×8). Larger matrices yield finer patterns; each channel is quantized independently.",
};

export const DitherStage = () => {
  const { state, updateDither } = usePipeline();
  const { method, threshold, density, bayerSize } = state.dither;

  const normalizedBayerSize: (typeof BAYER_SIZES)[number] =
    bayerSize <= 2 ? 2 : bayerSize <= 4 ? 4 : 8;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Dither method
        </span>
        <AnimatedSegmentedControl
          value={method}
          onValueChange={(id) => updateDither({ method: id })}
          ariaLabel="Select dither effect"
          listClassName="flex flex-wrap gap-1 rounded-lg border border-border p-1"
          options={DITHER_METHODS.map(({ id, label }) => ({
            id,
            label,
            ariaLabel: `${label} dither`,
          }))}
        />
      </div>

      <p className="text-xs text-muted-foreground">{INTROS[method]}</p>

      <div className="flex flex-col gap-4">
        {method === "threshold" && (
          <ParamSlider
            id="dither-threshold"
            label="Threshold"
            min={0}
            max={100}
            step={1}
            value={threshold}
            resetValue={DEFAULT_DITHER_PARAMS.threshold}
            formatValue={(v) => `${v}%`}
            onValueChange={(next) => updateDither({ threshold: next })}
            aria-label="Binary cutoff (0–100%)"
          />
        )}

        {method === "white-noise" && (
          <ParamSlider
            id="dither-density"
            label="Density"
            min={0}
            max={100}
            step={1}
            value={density}
            resetValue={DEFAULT_DITHER_PARAMS.density}
            formatValue={(v) => `${v}%`}
            onValueChange={(next) => updateDither({ density: next })}
            aria-label="Noise strength (0–100%)"
          />
        )}

        {method === "bayer" && (
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
                    onClick={() => updateDither({ bayerSize: size })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        updateDither({ bayerSize: size });
                      }
                    }}
                    className={cn(
                      "min-w-12 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {size}×{size}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
