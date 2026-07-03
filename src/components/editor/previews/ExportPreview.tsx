"use client";

import { PipelineOutputFitCanvas } from "@/components/editor/PipelineOutputFitCanvas";
import { ZoomablePreviewFrame } from "@/components/editor/previews/ZoomablePreviewFrame";
import type { PipelineOutput } from "@/lib/types";

type ExportPreviewProps = {
  pipelineOutput: PipelineOutput | null;
};

export const ExportPreview = ({ pipelineOutput }: ExportPreviewProps) => (
  <ZoomablePreviewFrame className="z-10">
    <PipelineOutputFitCanvas
      pipelineOutput={pipelineOutput}
      aria-label="Export preview: current pipeline output"
    />
  </ZoomablePreviewFrame>
);
