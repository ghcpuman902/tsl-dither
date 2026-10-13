"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ValueScrubber } from "@/components/ui/value-scrubber";
import { cn } from "@/lib/utils";

type ParamRangeSliderProps = {
  label: string;
  /** [low, high] — dual thumbs on one track. */
  value: readonly [number, number];
  onValueChange: (value: [number, number]) => void;
  min: number;
  max: number;
  step: number;
  resetValue?: readonly [number, number];
  formatValue?: (value: number) => string;
  /** Radix: minimum steps between thumbs so they cannot cross. */
  minStepsBetweenThumbs?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  lowLabel?: string;
  highLabel?: string;
  "aria-label"?: string;
};

export const ParamRangeSlider = ({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  resetValue,
  formatValue = (v) => String(v),
  minStepsBetweenThumbs = 1,
  disabled = false,
  id,
  className,
  lowLabel = "Low",
  highLabel = "High",
  "aria-label": ariaLabel,
}: ParamRangeSliderProps) => {
  const sliderLabel = ariaLabel ?? label;
  const [low, high] = value;

  const handleSliderChange = (next: number[]) => {
    const a = next[0] ?? min;
    const b = next[1] ?? max;
    onValueChange(a <= b ? [a, b] : [b, a]);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            "text-xs font-medium",
            disabled && "text-muted-foreground/70",
          )}
          htmlFor={id}
        >
          {label}
        </Label>
        <div className="flex items-center gap-1.5 tabular-nums">
          <ValueScrubber
            value={low}
            onValueChange={(v) =>
              onValueChange([Math.min(v, high - step), high])
            }
            min={min}
            max={high - step}
            step={step}
            resetValue={resetValue?.[0]}
            formatValue={formatValue}
            disabled={disabled}
            aria-label={`${sliderLabel} ${lowLabel}`}
          />
          <span className="text-[10px] text-muted-foreground" aria-hidden>
            –
          </span>
          <ValueScrubber
            value={high}
            onValueChange={(v) =>
              onValueChange([low, Math.max(v, low + step)])
            }
            min={low + step}
            max={max}
            step={step}
            resetValue={resetValue?.[1]}
            formatValue={formatValue}
            disabled={disabled}
            aria-label={`${sliderLabel} ${highLabel}`}
          />
        </div>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[low, high]}
        minStepsBetweenThumbs={minStepsBetweenThumbs}
        onValueChange={handleSliderChange}
        onDoubleClick={
          resetValue
            ? () => onValueChange([resetValue[0], resetValue[1]])
            : undefined
        }
        aria-label={sliderLabel}
        disabled={disabled}
        className={cn(disabled && "opacity-60")}
        title={
          resetValue && !disabled
            ? "Drag thumbs · double-click to reset"
            : undefined
        }
      />
    </div>
  );
};
