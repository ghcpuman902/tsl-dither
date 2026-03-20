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
  { id: "atkinson", label: "Atkinson" },
  { id: "burkes", label: "Burkes" },
  { id: "floyd-steinberg", label: "Floyd–Steinberg" },
  { id: "jjn", label: "Jarvis, Judice & Ninke" },
  { id: "sierra", label: "Sierra" },
  { id: "stucki", label: "Stucki" },
];

const INTROS: Record<DitherMethod, string> = {
  threshold:
    "Binary cutoff per channel: each R, G, B is 255 if at or above the threshold, else 0. Combined they give up to 8 colors.",
  "white-noise":
    "Randomized binary per channel: the cutoff is perturbed by noise so the result is grainier. Density controls how strong the noise is.",
  bayer:
    "Ordered dither using a precomputed Bayer matrix. Grid size sets the matrix dimensions. (Coming soon: full implementation.)",
  atkinson:
    "Atkinson error diffusion: distributes quantization error to neighbors with a 1/8 fraction. (Coming soon.)",
  burkes:
    "Burkes error diffusion with a 3-4-3 row pattern. (Coming soon.)",
  "floyd-steinberg":
    "Classic Floyd–Steinberg error diffusion to adjacent pixels. (Coming soon.)",
  jjn:
    "Jarvis, Judice & Ninke: 3-row error diffusion. (Coming soon.)",
  sierra:
    "Sierra-family error diffusion (e.g. 2-4-8). (Coming soon.)",
  stucki:
    "Stucki 5×5 error diffusion. (Coming soon.)",
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
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium" htmlFor="dither-bayer-size">
                Grid size
              </Label>
              <span className="tabular-nums text-xs text-muted-foreground">
                {bayerSize}
              </span>
            </div>
            <Slider
              id="dither-bayer-size"
              min={2}
              max={8}
              step={1}
              value={[bayerSize]}
              onValueChange={(v) =>
                updateDither({ bayerSize: Array.isArray(v) ? v[0] : v })
              }
              aria-label="Bayer matrix size"
            />
          </div>
        )}

        {["atkinson", "burkes", "floyd-steinberg", "jjn", "sierra", "stucki"].includes(
          method
        ) && (
          <p className="text-xs italic text-muted-foreground">
            Controls for this method will appear here when implemented.
          </p>
        )}
      </div>
    </div>
  );
};
