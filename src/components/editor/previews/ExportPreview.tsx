"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import type { PipelineOutput } from "@/lib/types";

type ExportPreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const ExportPreview = ({ pipelineOutput }: ExportPreviewProps) => (
  <div className="absolute inset-0 z-10">
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Export preview: current pipeline output"
    />
  </div>
);
