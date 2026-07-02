"use client";

import { ParamSlider } from "@/components/ui/param-slider";
import { DEFAULT_DITHER_PARAMS } from "@/lib/types";

type WhiteNoiseControlsProps = {
  density: number;
  onDensityChange: (value: number) => void;
};

export const WhiteNoiseControls = ({
  density,
  onDensityChange,
}: WhiteNoiseControlsProps) => (
  <ParamSlider
    id="dither-density"
    label="Density"
    min={0}
    max={100}
    step={1}
    value={density}
    resetValue={DEFAULT_DITHER_PARAMS.density}
    formatValue={(v) => `${v}%`}
    onValueChange={onDensityChange}
    aria-label="Noise strength (0–100%)"
  />
);
