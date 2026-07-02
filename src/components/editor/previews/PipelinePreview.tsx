"use client";

import type { StageId } from "@/lib/types";
import { LoadPreview } from "./LoadPreview";
import { DownsizePreview } from "./DownsizePreview";
import { TonePreview } from "./TonePreview";
import { DitherStagePreview } from "./DitherStagePreview";
import { ExportPreview } from "./ExportPreview";
import type { PipelineOutput } from "@/lib/types";

type PipelinePreviewProps = {
  activeStage: StageId;
  onProcessed: (imageData: ImageData) => void;
  downsizePreviewOutput: PipelineOutput | null;
  tonePreviewOutput: PipelineOutput | null;
  processedImageData: ImageData | null;
  pipelineOutput: PipelineOutput | null;
};

export const PipelinePreview = ({
  activeStage,
  onProcessed,
  downsizePreviewOutput,
  tonePreviewOutput,
  processedImageData,
  pipelineOutput,
}: PipelinePreviewProps) => (
  <div className="relative flex-1 bg-black">
    <LoadPreview onProcessed={onProcessed} isActive={activeStage === "load"} />
    {activeStage === "downsize" ? (
      <DownsizePreview pipelineOutput={downsizePreviewOutput} />
    ) : null}
    {activeStage === "tone" ? <TonePreview pipelineOutput={tonePreviewOutput} /> : null}
    {activeStage === "dither" ? (
      <DitherStagePreview processedImageData={processedImageData} />
    ) : null}
    {activeStage === "export" ? <ExportPreview pipelineOutput={pipelineOutput} /> : null}
  </div>
);
