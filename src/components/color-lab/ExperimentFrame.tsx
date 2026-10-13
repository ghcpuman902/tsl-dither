"use client";

import { useMemo, type ReactNode } from "react";
import { PaletteStrip, PixelCanvas } from "@/components/color-lab/PixelCanvas";
import {
  computePaletteStats,
  extractCrop,
} from "@/lib/color-lab/image-utils";
import type { CropRect, ProcessResult, Rgb } from "@/lib/color-lab/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ParamRangeSlider } from "@/components/ui/param-range-slider";
import { ParamSlider } from "@/components/ui/param-slider";
import { Switch } from "@/components/ui/switch";

type ExperimentFrameProps = {
  name: string;
  blurb: string;
  source: ImageData | null;
  result: ProcessResult | null;
  crop: CropRect;
  pinned: boolean;
  onTogglePin: () => void;
  diagram?: ReactNode;
  controls: ReactNode;
  extras?: ReactNode;
  showReconstruction?: boolean;
  onResultPixelClick?: (x: number, y: number) => void;
};

export const ExperimentFrame = ({
  name,
  blurb,
  source,
  result,
  crop,
  pinned,
  onTogglePin,
  diagram,
  controls,
  extras,
  showReconstruction = true,
  onResultPixelClick,
}: ExperimentFrameProps) => {
  const sourceCrop = useMemo(() => {
    if (!source) return null;
    return extractCrop(source.data, source.width, source.height, crop);
  }, [source, crop]);

  const resultCrop = useMemo(() => {
    if (!result) return null;
    return extractCrop(result.rgba, result.width, result.height, crop);
  }, [result, crop]);

  const reconCrop = useMemo(() => {
    if (!result?.reconstruction) return null;
    return extractCrop(
      result.reconstruction,
      result.width,
      result.height,
      crop,
    );
  }, [result, crop]);

  const stats = useMemo(() => {
    if (!source || !result) return null;
    return computePaletteStats(source.data, result.rgba);
  }, [source, result]);

  return (
    <section className="py-2">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">{name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
        </div>
        <Button
          type="button"
          variant={pinned ? "default" : "outline"}
          size="sm"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${name}` : `Pin ${name} for comparison`}
        >
          {pinned ? "Pinned" : "Pin"}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Figure label="Original">
            {source ? (
              <PixelCanvas
                rgba={source.data}
                width={source.width}
                height={source.height}
                label={`${name} original`}
              />
            ) : (
              <Empty />
            )}
          </Figure>
          <Figure label="Processed">
            {result ? (
              <PixelCanvas
                rgba={result.rgba}
                width={result.width}
                height={result.height}
                label={`${name} result`}
                onClickPixel={onResultPixelClick}
                className={onResultPixelClick ? "cursor-crosshair" : undefined}
              />
            ) : (
              <Empty />
            )}
          </Figure>
          <Figure label="Magnified crop">
            <div className="grid grid-cols-2 gap-1">
              {sourceCrop ? (
                <PixelCanvas
                  rgba={sourceCrop.rgba}
                  width={sourceCrop.size}
                  height={sourceCrop.size}
                  pixelated
                  label="Source crop"
                />
              ) : (
                <Empty />
              )}
              {resultCrop ? (
                <PixelCanvas
                  rgba={resultCrop.rgba}
                  width={resultCrop.size}
                  height={resultCrop.size}
                  pixelated
                  label="Result crop"
                />
              ) : (
                <Empty />
              )}
            </div>
          </Figure>
          <Figure label={showReconstruction ? "Local average" : "Palette"}>
            {showReconstruction && reconCrop ? (
              <PixelCanvas
                rgba={reconCrop.rgba}
                width={reconCrop.size}
                height={reconCrop.size}
                pixelated
                label="Reconstruction"
              />
            ) : result ? (
              <PaletteStrip colors={result.palette} className="p-2" />
            ) : (
              <Empty />
            )}
          </Figure>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {diagram}
          {result ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {result.uniqueCount} colours
                {stats
                  ? ` · ΔL ${stats.luminanceError.toFixed(3)} · ΔE₀ₖ ${stats.perceptualError.toFixed(3)} · C̄ ${stats.averageChroma.toFixed(3)}`
                  : null}
              </div>
              <PaletteStrip colors={result.palette} />
            </div>
          ) : null}
          <div className="space-y-3 rounded-md border border-border/60 bg-background/80 p-3">
            {controls}
          </div>
          {extras}
        </aside>
      </div>
    </section>
  );
};

const Figure = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <figure className="min-w-0">
    <figcaption className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
      {label}
    </figcaption>
    <div className="overflow-hidden border border-border bg-[repeating-conic-gradient(#80808022_0%_25%,transparent_0%_50%)] bg-size-[12px_12px]">
      {children}
    </div>
  </figure>
);

const Empty = () => (
  <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
    —
  </div>
);

/** DialKit-style stacked slider: label + scrubber, full-width track. */
export const FloatSlider = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v: number) => v.toFixed(2),
  resetValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  resetValue?: number;
}) => (
  <ParamSlider
    label={label}
    value={value}
    min={min}
    max={max}
    step={step}
    resetValue={resetValue ?? value}
    formatValue={format}
    onValueChange={onChange}
    aria-label={label}
  />
);

/** Dual-thumb range for low/high pairs. */
export const FloatRangeSlider = ({
  label,
  low,
  high,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v: number) => v.toFixed(2),
  resetValue,
}: {
  label: string;
  low: number;
  high: number;
  min: number;
  max: number;
  step?: number;
  onChange: (low: number, high: number) => void;
  format?: (v: number) => string;
  resetValue?: readonly [number, number];
}) => (
  <ParamRangeSlider
    label={label}
    value={[low, high]}
    min={min}
    max={max}
    step={step}
    resetValue={resetValue}
    formatValue={format}
    minStepsBetweenThumbs={1}
    onValueChange={([lo, hi]) => onChange(lo, hi)}
    aria-label={label}
  />
);

export const SelectControl = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs font-medium">{label}</Label>
    <select
      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

export const ToggleControl = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3 py-0.5">
    <Label className="text-xs font-medium">{label}</Label>
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    />
  </div>
);

export type { Rgb };
