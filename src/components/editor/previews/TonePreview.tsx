"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import { ZoomablePreviewFrame } from "@/components/editor/previews/ZoomablePreviewFrame";
import type { PipelineOutput } from "@/lib/types";

type TonePreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const TonePreview = ({ pipelineOutput }: TonePreviewProps) => (
  <ZoomablePreviewFrame>
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Tone preview: downsized and tone-adjusted frame"
    />
  </ZoomablePreviewFrame>
);
