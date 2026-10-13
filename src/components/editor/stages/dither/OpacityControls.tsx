"use client";

import { ParamSlider } from "@/components/ui/param-slider";
import { DEFAULT_DITHER_PARAMS } from "@/lib/types";

type OpacityControlsProps = {
  opacity: number;
  onOpacityChange: (value: number) => void;
};

/** White-noise influence. 0 = pure threshold; 100 = full noise swing. */
export const OpacityControls = ({
  opacity,
  onOpacityChange,
}: OpacityControlsProps) => (
  <ParamSlider
    id="dither-opacity"
    label="Opacity"
    min={0}
    max={100}
    step={1}
    value={opacity}
    resetValue={DEFAULT_DITHER_PARAMS.opacity}
    formatValue={(v) => `${v}%`}
    onValueChange={onOpacityChange}
    aria-label="White noise opacity (0 = pure threshold, 100 = full noise)"
  />
);
