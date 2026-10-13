"use client";

import { usePipelineActions, usePipelineState } from "@/lib/pipeline-context";
import type { DitherMethod } from "@/lib/types";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { ThresholdControls } from "./dither/ThresholdControls";
import { OpacityControls } from "./dither/OpacityControls";
import { BayerControls } from "./dither/BayerControls";

const DITHER_METHODS: { id: DitherMethod; label: string }[] = [
  { id: "threshold", label: "Threshold" },
  { id: "bayer", label: "Bayer" },
];

const INTROS: Record<DitherMethod, string> = {
  threshold:
    "Binary cutoff per channel. Opacity adds white-noise sway to the cutoff — 0 is a hard threshold, higher values get grainier.",
  bayer:
    "Ordered dither using a Bayer threshold matrix (2×2, 4×4, or 8×8). Larger matrices yield finer patterns; each channel is quantized independently.",
};

export const DitherStage = () => {
  const { state } = usePipelineState();
  const { updateDither } = usePipelineActions();
  const { method, threshold, opacity, bayerSize } = state.dither;

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
          <>
            <ThresholdControls
              threshold={threshold}
              onThresholdChange={(next) => updateDither({ threshold: next })}
            />
            <OpacityControls
              opacity={opacity}
              onOpacityChange={(next) => updateDither({ opacity: next })}
            />
          </>
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
