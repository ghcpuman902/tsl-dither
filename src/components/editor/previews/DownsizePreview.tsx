"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import type { PipelineOutput } from "@/lib/types";

type DownsizePreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const DownsizePreview = ({ pipelineOutput }: DownsizePreviewProps) => (
  <div className="absolute inset-0">
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Downsize preview: resized pipeline frame"
    />
  </div>
);
