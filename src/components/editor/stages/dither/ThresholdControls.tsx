"use client";

import { ParamSlider } from "@/components/ui/param-slider";
import { DEFAULT_DITHER_PARAMS } from "@/lib/types";

type ThresholdControlsProps = {
  threshold: number;
  onThresholdChange: (value: number) => void;
};

export const ThresholdControls = ({
  threshold,
  onThresholdChange,
}: ThresholdControlsProps) => (
  <ParamSlider
    id="dither-threshold"
    label="Threshold"
    min={0}
    max={100}
    step={1}
    value={threshold}
    resetValue={DEFAULT_DITHER_PARAMS.threshold}
    formatValue={(v) => `${v}%`}
    onValueChange={onThresholdChange}
    aria-label="Binary cutoff (0–100%)"
  />
);
