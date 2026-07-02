"use client";

import { usePipelineActions, usePipelineState } from "@/lib/pipeline-context";
import type { DitherMethod } from "@/lib/types";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { ThresholdControls } from "./dither/ThresholdControls";
import { WhiteNoiseControls } from "./dither/WhiteNoiseControls";
import { BayerControls } from "./dither/BayerControls";

const DITHER_METHODS: { id: DitherMethod; label: string }[] = [
  { id: "threshold", label: "Threshold" },
  { id: "white-noise", label: "White noise" },
  { id: "bayer", label: "Bayer" },
];

const INTROS: Record<DitherMethod, string> = {
  threshold:
    "Binary cutoff per channel: each R, G, B is 255 if at or above the threshold, else 0. Combined they give up to 8 colors.",
  "white-noise":
    "Randomized binary per channel: the cutoff is perturbed by noise so the result is grainier. Density controls how strong the noise is.",
  bayer:
    "Ordered dither using a Bayer threshold matrix (2×2, 4×4, or 8×8). Larger matrices yield finer patterns; each channel is quantized independently.",
};

export const DitherStage = () => {
  const { state } = usePipelineState();
  const { updateDither } = usePipelineActions();
  const { method, threshold, density, bayerSize } = state.dither;

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
        {method === "threshold" ? (
          <ThresholdControls
            threshold={threshold}
            onThresholdChange={(next) => updateDither({ threshold: next })}
          />
        ) : null}
        {method === "white-noise" ? (
          <WhiteNoiseControls
            density={density}
            onDensityChange={(next) => updateDither({ density: next })}
          />
        ) : null}
        {method === "bayer" ? (
          <BayerControls
            bayerSize={bayerSize}
            onBayerSizeChange={(size) => updateDither({ bayerSize: size })}
          />
        ) : null}
      </div>
    </div>
  );
};
