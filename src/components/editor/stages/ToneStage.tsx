"use client";

import { useState } from "react";
import { usePipeline } from "@/lib/pipeline-context";
import { Histogram } from "@/components/editor/Histogram";
import { ToneSliders } from "@/components/editor/controls/ToneSliders";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RotateCcw } from "lucide-react";

export const ToneStage = () => {
  const { resetTone } = usePipeline();
  const [showRawSpikes, setShowRawSpikes] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Histogram */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Histogram
        </span>
        <div className="min-h-[84px] rounded-md bg-black/60 p-2">
          <Histogram smooth={!showRawSpikes} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <Label htmlFor="tone-histogram-raw-toggle" className="text-xs text-muted-foreground">
            Show raw spikes
          </Label>
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
