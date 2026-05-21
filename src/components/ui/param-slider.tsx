"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ValueScrubber } from "@/components/ui/value-scrubber";
import { cn } from "@/lib/utils";

type ParamSliderProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  resetValue?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

export const ParamSlider = ({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  resetValue = 0,
  formatValue,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
}: ParamSliderProps) => {
  const sliderLabel = ariaLabel ?? label;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            "text-xs font-medium",
            disabled && "text-muted-foreground/70"
          )}
          htmlFor={id}
        >
          {label}
        </Label>
        <ValueScrubber
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          resetValue={resetValue}
          formatValue={formatValue}
          disabled={disabled}
          aria-label={`${sliderLabel} value`}
        />
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        resetValue={resetValue}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : (v as number);
          onValueChange(next);
        }}
        aria-label={sliderLabel}
        disabled={disabled}
        className={cn(disabled && "opacity-60")}
      />
    </div>
  );
};
