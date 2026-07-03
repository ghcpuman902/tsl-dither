"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import { ZoomablePreviewFrame } from "@/components/editor/previews/ZoomablePreviewFrame";
import type { PipelineOutput } from "@/lib/types";

type DownsizePreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const DownsizePreview = ({ pipelineOutput }: DownsizePreviewProps) => (
  <ZoomablePreviewFrame>
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Downsize preview: resized pipeline frame"
    />
  </ZoomablePreviewFrame>
);
