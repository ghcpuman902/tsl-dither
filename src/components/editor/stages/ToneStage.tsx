"use client";

import { usePipeline } from "@/lib/pipeline-context";
import { Histogram } from "@/components/editor/Histogram";
import { ToneSliders } from "@/components/editor/controls/ToneSliders";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw } from "lucide-react";

type Props = {
  processedImageData: ImageData | null;
};

export const ToneStage = ({ processedImageData }: Props) => {
  const { resetTone } = usePipeline();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Histogram */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Histogram
        </span>
        <div className="min-h-[84px] rounded-md bg-black/60 p-2">
          <Histogram />
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
