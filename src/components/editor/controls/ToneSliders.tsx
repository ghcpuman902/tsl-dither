"use client";

import { usePipelineActions, usePipelineState } from "@/lib/pipeline-context";
import { Slider } from "@/components/ui/slider";
import { ValueScrubber } from "@/components/ui/value-scrubber";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToneParams } from "@/lib/types";

type SliderConfig = {
  key: keyof ToneParams;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderConfig[] = [
  { key: "exposure",    label: "Exposure",     min: -5,   max: 5,   step: 0.05 },
  { key: "contrast",    label: "Contrast",     min: -100, max: 100, step: 1 },
  { key: "highlights",  label: "Highlights",   min: -100, max: 100, step: 1 },
  { key: "shadows",     label: "Shadows",      min: -100, max: 100, step: 1 },
  { key: "whites",      label: "Whites",       min: -100, max: 100, step: 1 },
  { key: "blacks",      label: "Blacks",       min: -100, max: 100, step: 1 },
  { key: "saturation",  label: "Saturation",   min: -100, max: 100, step: 1 },
  { key: "temperature", label: "Temperature",  min: -100, max: 100, step: 1 },
];

const formatValue = (key: keyof ToneParams, value: number): string => {
  if (key === "exposure") return (value >= 0 ? "+" : "") + value.toFixed(2);
  return (value > 0 ? "+" : "") + value.toFixed(0);
};

export const ToneSliders = () => {
  const { state } = usePipelineState();
  const { updateTone, updateToneVisible } = usePipelineActions();

  const handleEyeClick = (key: keyof ToneParams) => {
    const visible = state.toneVisible[key];
    updateToneVisible(key, !visible);
  };

  const handleEyeKeyDown = (e: React.KeyboardEvent, key: keyof ToneParams) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleEyeClick(key);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {SLIDERS.map(({ key, label, min, max, step }) => {
        const visible = state.toneVisible[key];
        const value = state.tone[key];

        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleEyeClick(key)}
                  onKeyDown={(e) => handleEyeKeyDown(e, key)}
                  aria-label={visible ? `Hide ${label}` : `Show ${label}`}
                  tabIndex={0}
                >
                  {visible ? (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  )}
                </Button>
                <Label
                  className={cn(
                    "truncate text-xs font-medium",
                    !visible && "text-muted-foreground/70"
                  )}
                >
                  {label}
                </Label>
              </div>
              <ValueScrubber
                value={value}
                onValueChange={(next) => updateTone({ [key]: next })}
                min={min}
                max={max}
                step={step}
                resetValue={0}
                formatValue={(v) => formatValue(key, v)}
                disabled={!visible}
                aria-label={`${label} value`}
              />
            </div>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[value]}
              resetValue={0}
              onValueChange={(v) => {
                const sv = Array.isArray(v) ? v[0] : (v as number);
                updateTone({ [key]: sv });
              }}
              aria-label={label}
              disabled={!visible}
              className={cn(!visible && "opacity-60")}
            />
          </div>
        );
      })}
    </div>
  );
};
