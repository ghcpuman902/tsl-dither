"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import type { PipelineOutput } from "@/lib/types";

type TonePreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const TonePreview = ({ pipelineOutput }: TonePreviewProps) => (
  <div className="absolute inset-0">
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Tone preview: downsized and tone-adjusted frame"
    />
  </div>
);
