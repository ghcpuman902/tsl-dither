"use client";

import { useState } from "react";
import { usePipelineActions } from "@/lib/pipeline-context";
import { Histogram } from "@/components/editor/Histogram";
import { ToneSliders } from "@/components/editor/controls/ToneSliders";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, RotateCcw } from "lucide-react";

export const ToneStage = () => {
  const { resetTone } = usePipelineActions();
  const [showRawSpikes, setShowRawSpikes] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Histogram */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Histogram
        </span>
        <div className="min-h-[84px] rounded-md bg-black/60 p-2">
          <Histogram mode={showRawSpikes ? "raw" : "smooth"} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <div className="flex items-center gap-1">
            <Label
              htmlFor="tone-histogram-raw-toggle"
              className="text-xs text-muted-foreground"
            >
              Show raw spikes
            </Label>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="About histogram smoothing"
                  >
                    <Info className="size-3" />
                  </button>
                }
              />
              <TooltipContent side="top" align="start" className="max-w-[260px] text-left leading-relaxed">
                By default, the histogram is smoothed for better performance on
                high-frequency data and to match how Photoshop displays
                histograms—aligning more closely with human perception. Enable
                this to show exact per-bin spikes.
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            id="tone-histogram-raw-toggle"
            size="sm"
            checked={showRawSpikes}
            onCheckedChange={setShowRawSpikes}
            aria-label="Toggle raw histogram spikes"
          />
        </div>
      </div>

      <Separator />

      {/* Tone sliders */}
      <ToneSliders />

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-muted-foreground"
        onClick={resetTone}
        aria-label="Reset all tone adjustments to zero"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset Tone
      </Button>
    </div>
  );
};
