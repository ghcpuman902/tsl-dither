"use client";

import { usePipeline } from "@/lib/pipeline-context";
import type { DitherMethod } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

  const handleMethodClick = (id: DitherMethod) => {
    updateDither({ method: id });
  };

  const handleMethodKeyDown = (e: React.KeyboardEvent, id: DitherMethod) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleMethodClick(id);
    }
  };

  const normalizedBayerSize: (typeof BAYER_SIZES)[number] =
    bayerSize <= 2 ? 2 : bayerSize <= 4 ? 4 : 8;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Dither method
        </span>
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-border p-1"
          role="tablist"
          aria-label="Select dither effect"
        >
          {DITHER_METHODS.map(({ id, label }) => {
            const selected = method === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${label} dither`}
                tabIndex={selected ? 0 : -1}
                onClick={() => handleMethodClick(id)}
                onKeyDown={(e) => handleMethodKeyDown(e, id)}
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

      <p className="text-xs text-muted-foreground">{INTROS[method]}</p>

      <div className="flex flex-col gap-4">
        {method === "threshold" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium" htmlFor="dither-threshold">
                Threshold
              </Label>
              <span className="tabular-nums text-xs text-muted-foreground">
                {threshold}%
              </span>
            </div>
            <Slider
              id="dither-threshold"
              min={0}
              max={100}
              step={1}
              value={[threshold]}
              onValueChange={(v) =>
                updateDither({ threshold: Array.isArray(v) ? v[0] : v })
              }
              aria-label="Binary cutoff (0–100%)"
            />
          </div>
        )}

        {method === "white-noise" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium" htmlFor="dither-density">
                Density
              </Label>
              <span className="tabular-nums text-xs text-muted-foreground">
                {density}%
              </span>
            </div>
            <Slider
              id="dither-density"
              min={0}
              max={100}
              step={1}
              value={[density]}
              onValueChange={(v) =>
                updateDither({ density: Array.isArray(v) ? v[0] : v })
              }
              aria-label="Noise strength (0–100%)"
            />
          </div>
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
